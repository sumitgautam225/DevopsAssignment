
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "--- 1. Initial Setup "

sudo apt-get update
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  openjdk-17-jdk \
  git \
  ufw

echo "--- 2. Installing  Docker ---"

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Add current user to the docker group
sudo usermod -aG docker $USER
echo "SUCCESS: Docker installed. Log out and log back in for the 'docker' group membership to take effect."

echo "--- 3. Installing  Jenkins ---"

# Add Jenkins GPG key
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

# Add Jenkins repository
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt-get update
sudo apt-get install -y jenkins

# Ensure Jenkins is enabled and running
sudo systemctl enable jenkins
sudo systemctl start jenkins

echo "--- 4. Firewall Configuration (UFW) ---"

sudo ufw allow 22/tcp  # Allow SSH
sudo ufw allow 8080/tcp # Allow Jenkins default port
echo "y" | sudo ufw enable

echo "--- 5. Verification ---"

echo "Verifying service status..."

echo "--------------------------------------------------------"
echo "Git Version:"
git --version

echo "--------------------------------------------------------"
echo "Docker Service Status:"
sudo systemctl status docker | grep 'Active:'

echo "--------------------------------------------------------"
echo "Jenkins Service Status:"
sudo systemctl status jenkins | grep 'Active:'

echo "--------------------------------------------------------"
echo "Firewall Status:"
sudo ufw status verbose | grep -E 'Status:|8080|22'

echo "--- 6. Post-Installation Steps ---"

JENKINS_PASSWORD=$(sudo cat /var/lib/jenkins/secrets/initialAdminPassword)
echo "========================================================"
echo "INSTALLATION COMPLETE"
echo "========================================================"
echo "1. Jenkins is running on port 8080."

