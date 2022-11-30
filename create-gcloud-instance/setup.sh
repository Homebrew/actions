#!/bin/bash
set -xeo pipefail

RUNNER_NAME=$(curl http://metadata.google.internal/computeMetadata/v1/instance/attributes/RUNNER_NAME -H "Metadata-Flavor: Google")
VM_TOKEN=$(curl http://metadata.google.internal/computeMetadata/v1/instance/attributes/VM_TOKEN -H "Metadata-Flavor: Google")
REPOSITORY_NAME=$(curl http://metadata.google.internal/computeMetadata/v1/instance/attributes/REPOSITORY_NAME -H "Metadata-Flavor: Google")
GITHUB_TOKEN=$(curl http://metadata.google.internal/computeMetadata/v1/instance/attributes/GITHUB_TOKEN -H "Metadata-Flavor: Google")

# Initial setup: setup docker and github actions runner.
# This is done only once, if the machine is stopped/started, this block of code is not executed again.
if [[ ! -d "/home/actions" ]]; then
    # Setup docker
    apt-get -y update && apt-get install -y curl apt-transport-https ca-certificates software-properties-common jq wget

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    codename=$(lsb_release -cs)
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu ${codename} stable"

    apt-get update

    apt-get install -y docker-ce

    useradd -m actions

    # Add user to docker group and restart docker to make group take effect
    usermod -aG docker actions
    newgrp docker
    systemctl restart docker

    curl -o /home/actions/install_runner.sh https://raw.githubusercontent.com/Homebrew/actions/master/create-gcloud-instance/install_runner.sh
    curl -o /home/actions/config_runner.sh https://raw.githubusercontent.com/Homebrew/actions/master/create-gcloud-instance/config_runner.sh
    chmod +x /home/actions/install_runner.sh
    chmod +x /home/actions/config_runner.sh

    # This needs to be run with the actions user:
    su -c "/home/actions/install_runner.sh" actions

    # Disable pipefail as this breaks installdependencies.sh
    # See https://github.com/actions/runner/pull/1228#issuecomment-896242967
    set +xeo pipefail
    # This needs to be run as root:
    # shellcheck disable=SC1091
    source /home/actions/actions-runner/bin/installdependencies.sh
    set -xeo pipefail

    # This needs to be run with the actions user:
    RUNNER_NAME=${RUNNER_NAME} VM_TOKEN=${VM_TOKEN} REPOSITORY_NAME=${REPOSITORY_NAME} GITHUB_TOKEN=${GITHUB_TOKEN} su -c "/home/actions/config_runner.sh" actions
fi

curl -o /home/actions/start_runner.sh https://raw.githubusercontent.com/Homebrew/actions/master/create-gcloud-instance/start_runner.sh
chmod +x /home/actions/start_runner.sh

su -p -c "/home/actions/start_runner.sh" actions
