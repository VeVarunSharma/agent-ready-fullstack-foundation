using '../main.bicep'

param config = loadJsonContent('./production.config.json')
param enableFoundry = false
