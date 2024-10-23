# <img src="https://raw.githubusercontent.com/factrylabs/factry-historian-datasource/main/src/img/logo.svg" alt="Factry Historian Logo" height="30"> Factry Historian Datasource

[Grafana](https://grafana.com) datasource for [Factry Historian](https://factry.io).

## Development

A data source backend plugin consists of both frontend and backend components, frontend components reside in `/src` and backend components reside in `/pkg`.

### Prerequisites

- [Go 1.23.2 or later](https://golang.org/dl/)
  - [Mage](https://magefile.org/)
- [Node.js 20 LTS](https://nodejs.org/en/download/) with [pnpm 8](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/)

After starting the application in either debug or normal mode, navigate to [http://localhost:3001](http://localhost:3001) to view the plugin in Grafana. The datasource, along with some dashboards, will be automatically provisioned.

### Debug mode

To run the plugin in debug mode, with filewatchers and hot-reloading enabled:

```bash
make clean  # optional
make run_debug
```

### Normal mode

To run the plugin in normal mode, without filewatchers and hot-reloading:

```bash
make clean  # optional
make build_all
make run_server
```
