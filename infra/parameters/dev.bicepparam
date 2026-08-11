using '../main.bicep'

param environmentName = 'dev'
param location = 'eastus'
param deployApp = false
param containerImage = ''
param minReplicas = 0
param maxReplicas = 3
