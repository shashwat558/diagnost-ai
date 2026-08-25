# Diagnost AI — GCP deployment skeleton (Compute Engine + Cloud SQL + GCS)
# Minimal single-VM profile for small teams; scale-out mirrors the AWS module.
#
# usage:
#   terraform init
#   terraform plan -var="project_id=my-project"

terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

variable "project_id" { type = string }
variable "region" { default = "us-central1" }
variable "zone" { default = "us-central1-a" }
variable "machine_type" { default = "n2-standard-8" } # 8 vCPU / 32GB — fits full stack

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_compute_network" "main" {
  name = "diagnost"
}

resource "google_sql_database_instance" "postgres" {
  name             = "diagnost-pg"
  database_version = "POSTGRES_16"
  region           = var.region
  settings {
    tier = "db-custom-2-7680"
    backup_configuration { enabled = true }
  }
  deletion_protection = true
}

resource "google_sql_database" "diagnost" {
  name     = "diagnost"
  instance = google_sql_database_instance.postgres.name
}

resource "google_storage_bucket" "blobs" {
  name          = "diagnost-blobs"
  location      = "US"
  force_destroy = false
  uniform_bucket_level_access = true
}

resource "google_compute_instance" "stack" {
  name         = "diagnost-stack"
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 200 # ClickHouse + Redpanda + MinIO data
    }
  }

  network_interface {
    network = google_compute_network.main.id
    access_config {} # ephemeral public IP; front with a load balancer in prod
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    curl -fsSL https://get.docker.com | sh
    git clone https://github.com/shashwat558/diagnost-ai /opt/diagnost-ai
    cd /opt/diagnost-ai
    docker compose up -d --wait
  EOF

  tags = ["diagnost"]
}

resource "google_compute_firewall" "https" {
  name    = "diagnost-https"
  network = google_compute_network.main.name
  allow { protocol = "tcp", ports = ["443", "80"] }
  target_tags = ["diagnost"]
}

output "stack_ip" { value = google_compute_instance.stack.network_interface[0].access_config[0].nat_ip }
output "cloudsql" { value = google_sql_database_instance.postgres.connection_name }
