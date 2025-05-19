# <img src="https://raw.githubusercontent.com/factrylabs/factry-historian-datasource/main/src/img/logo.svg" alt="Factry Historian Logo" height="30"> Factry Historian Datasource

The Factry Historian datasource plugin for [Grafana](https://grafana.com) allows you to seamlessly visualize time-series and event data collected and stored by [Factry Historian](https://www.factry.io/historian). Connect your Historian instance and start building dashboards with your industrial data in minutes.

> ⚡ New to Factry Historian?
If you don’t have Factry Historian running yet, no problem! You can quickly trial the software using a [ready-to-run docker-compose setup](https://github.com/factrylabs/historian). It spins up a local Historian instance with a 2-hour runtime limit, perfect for testing the Grafana datasource and exploring your data without installing anything permanently.

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
