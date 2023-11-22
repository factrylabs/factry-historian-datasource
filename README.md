# Grafana Factry Historian Data Source
## Getting started

A data source backend plugin consists of both frontend and backend components.

### Running the datasource locally

#### Debug mode

```bash
make clean
make build_debug
make run_debug
```

#### Normal mode

```bash
make clean
make build_all
make run_server
```

### Frontend

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Build plugin in development mode or run in watch mode

   ```bash
   pnpm dev
   ```

   or

   ```bash
   pnpm watch
   ```

3. Build plugin in production mode

   ```bash
   pnpm build
   ```

### Backend

1. Update [Grafana plugin SDK for Go](https://grafana.com/docs/grafana/latest/developers/plugins/backend/grafana-plugin-sdk-for-go/) dependency to the latest minor version:

   ```bash
   go get -u github.com/grafana/grafana-plugin-sdk-go
   go mod tidy
   ```

2. Build backend plugin binaries for Linux, Windows and Darwin:

   ```bash
   mage -v
   ```

3. List all available Mage targets for additional commands:

   ```bash
   mage -l
   ```

## Learn more

- [Build a data source backend plugin tutorial](https://grafana.com/tutorials/build-a-data-source-backend-plugin)
- [Grafana documentation](https://grafana.com/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/) - Grafana Tutorials are step-by-step guides that help you make the most of Grafana
- [Grafana UI Library](https://developers.grafana.com/ui) - UI components to help you build interfaces using Grafana Design System
- [Grafana plugin SDK for Go](https://grafana.com/docs/grafana/latest/developers/plugins/backend/grafana-plugin-sdk-for-go/)
