#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${DEPLOY_STACK_DIR:?DEPLOY_STACK_DIR is required}"
: "${PRODUCTION_URL:?PRODUCTION_URL is required}"

short_sha=${GITHUB_SHA:0:12}
release_image="personal-web-solar-management:release-${short_sha}"
production_image="personal-web-solar-management:1"
rollback_image="personal-web-solar-management:rollback-before-${short_sha}"
candidate_container="solar-candidate-${GITHUB_RUN_ID}"
compose_file="${DEPLOY_STACK_DIR}/compose.solar.yml"
deploy_env="${DEPLOY_STACK_DIR}/apps/solar-management/.env.production"
backup_dir="${DEPLOY_STACK_DIR}/backups"
compose=(docker compose -p solar-management -f "$compose_file")
promoted=0

cleanup() {
  status=$?
  set +e
  docker container rm --force "$candidate_container" >/dev/null 2>&1
  if [[ $status -ne 0 && $promoted -eq 1 ]]; then
    echo "Deployment failed after promotion; restoring ${rollback_image}." >&2
    docker image tag "$rollback_image" "$production_image"
    SOLAR_APP_IMAGE="$production_image" "${compose[@]}" up -d --no-deps --force-recreate --wait solar-management
  fi
  exit "$status"
}
trap cleanup EXIT

test -f "$compose_file"
test -f "$deploy_env"
docker image inspect "$production_image" >/dev/null
docker image tag "$production_image" "$rollback_image"

docker build \
  --build-arg APP_BASE_PATH=/projects/solar-management/ \
  --label "org.opencontainers.image.revision=${GITHUB_SHA}" \
  --tag "$release_image" \
  .

umask 077
mkdir -p "$backup_dir"
backup_file="${backup_dir}/solar-$(date -u +%Y%m%dT%H%M%SZ)-${short_sha}.dump"
"${compose[@]}" exec -T solar-db \
  pg_dump -U solar_app -d solar_management -Fc > "$backup_file"
test -s "$backup_file"
echo "Created pre-deployment backup: ${backup_file}"

SOLAR_APP_IMAGE="$release_image" "${compose[@]}" run --rm solar-migrate

docker run --detach \
  --name "$candidate_container" \
  --env-file "$deploy_env" \
  --network solar-management_solar-internal \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m,uid=1000,gid=1000 \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "$release_image" >/dev/null

for attempt in {1..45}; do
  if docker exec "$candidate_container" node -e \
      "fetch('http://127.0.0.1:3001/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  if [[ $attempt -eq 45 ]]; then
    docker logs "$candidate_container"
    exit 1
  fi
  sleep 2
done

docker container rm --force "$candidate_container" >/dev/null
docker image tag "$release_image" "$production_image"
promoted=1
SOLAR_APP_IMAGE="$production_image" "${compose[@]}" up -d --no-deps --force-recreate --wait solar-management

deployed_revision=$(docker inspect solar-management-solar-management-1 --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')
test "$deployed_revision" = "$GITHUB_SHA"
curl --fail --silent --show-error --retry 5 --retry-all-errors \
  "${PRODUCTION_URL%/}/projects/solar-management/api/ready" >/dev/null
curl --fail --silent --show-error \
  "${PRODUCTION_URL%/}/projects/solar-management/" >/dev/null

promoted=0
echo "Solar Management ${GITHUB_SHA} is live; rollback image: ${rollback_image}."
