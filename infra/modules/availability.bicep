param name string
param applicationInsightsId string
param healthUrl string
param actionGroupResourceId string = ''
param tags object

resource availabilityTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: name
  location: 'global'
  tags: union(tags, {
    'hidden-link:${applicationInsightsId}': 'Resource'
  })
  kind: 'standard'
  properties: {
    SyntheticMonitorId: name
    Name: name
    Description: 'Checks the public process and deployment health endpoint.'
    Enabled: true
    Frequency: 300
    Timeout: 30
    Kind: 'standard'
    RetryEnabled: true
    Locations: [
      {
        Id: 'us-tx-sn1-azr'
      }
    ]
    Request: {
      RequestUrl: healthUrl
      HttpVerb: 'GET'
      ParseDependentRequests: false
      FollowRedirects: true
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      IgnoreHttpStatusCode: false
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 7
    }
  }
}

resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${name}-alert'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alerts when the health endpoint fails from the availability test location.'
    severity: 2
    enabled: true
    scopes: [
      availabilityTest.id
      applicationInsightsId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: availabilityTest.id
      componentId: applicationInsightsId
      failedLocationCount: 1
    }
    actions: empty(actionGroupResourceId)
      ? []
      : [
          {
            actionGroupId: actionGroupResourceId
          }
        ]
  }
}
