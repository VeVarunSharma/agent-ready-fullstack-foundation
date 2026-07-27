using '../main.bicep'

param config = loadJsonContent('./compile.config.json')
param enableFoundry = false
