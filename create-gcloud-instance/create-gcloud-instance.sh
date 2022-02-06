#!/bin/bash
set -eo pipefail

# shellcheck disable=SC2154
VM_TOKEN=$(curl --silent -X POST -H "authorization: token ${GITHUB_TOKEN}" "https://api.github.com/repos/${REPOSITORY_NAME}/actions/runners/registration-token" | jq -r .token)

GCLOUD_SCOPES="https://www.googleapis.com/auth/devstorage.read_only,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/servicecontrol,https://www.googleapis.com/auth/service.management.readonly,https://www.googleapis.com/auth/trace.append"
GCLOUD_IMAGE="ubuntu-2004-focal-v20211202"
GCLOUD_ZONE="europe-west1-b"
GCLOUD_MACHINE="e2-standard-8"
GCLOUD_DISK_SIZE="50GB"
# shellcheck disable=SC2154
STARTUP_SCRIPT="${GITHUB_ACTION_PATH}/setup.sh"

# shellcheck disable=SC2154
echo ">> checking for already existing ${GCP_RUNNER_NAME} instance"
runner=$(gcloud compute instances list --format="value(name)" --filter="${GCP_RUNNER_NAME}" | head -n 1)
if [[ -n "${runner}" ]]
then
     echo ">> deleting old ${runner} instance"
     echo ">> this might take some time ..."
     # shellcheck disable=SC2154
     gcloud compute --project="${GCP_PROJECT_ID}" instances delete "${GCP_RUNNER_NAME}" --zone="${GCLOUD_ZONE}" --quiet
fi

echo ">> create new instance"
# shellcheck disable=SC2154
gcloud compute --project="${GCP_PROJECT_ID}" instances create "${GCP_RUNNER_NAME}" \
               --zone="${GCLOUD_ZONE}" \
               --machine-type="${GCLOUD_MACHINE}" \
               --subnet=default  \
               --network-tier=PREMIUM  \
               --maintenance-policy=MIGRATE \
               --service-account="${GCP_SERVICE_ACCOUNT}" \
               --scopes="${GCLOUD_SCOPES}" \
               --image-family="${GCLOUD_IMAGE}" \
               --image-project=ubuntu-os-cloud \
               --boot-disk-size="${GCLOUD_DISK_SIZE}" \
               --boot-disk-type=pd-ssd \
               --boot-disk-device-name="${GCP_RUNNER_NAME}" \
               --no-shielded-secure-boot \
               --shielded-vtpm \
               --shielded-integrity-monitoring \
               --reservation-affinity=any \
               --metadata-from-file startup-script="${STARTUP_SCRIPT}" \
               --metadata RUNNER_NAME="${GCP_RUNNER_NAME}",VM_TOKEN="${VM_TOKEN}",REPOSITORY_NAME="${REPOSITORY_NAME}",GITHUB_TOKEN="${GITHUB_TOKEN}"
