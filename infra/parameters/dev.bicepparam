using '../main.bicep'

param environmentName = 'dev'
param location = 'eastus'
param deployApp = false
param containerImage = 'registry.invalid/agent-tool-server-offerup@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param minReplicas = 0
param maxReplicas = 3
