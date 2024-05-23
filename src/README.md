# <img src="https://github.com/factrylabs/factry-historian-datasource/blob/0fd287221ba1e57c87fbdfd5d570e6537296c8c6/src/img/logo.svg" alt="Factry Historian Logo" height="30"> Factry Historian Datasource

[Grafana](https://grafana.com) datasource for [Factry Historian](https://factry.io).

## Introduction

Empower any employee to analyze process data in a user-friendly way. The Grafana data source on top of Factry Historian allows business users to trend time-series data and analyze events, such as batches or shifts – with zero technical skills required.

## Features

- Query historical data using the asset tree defined in Factry Historian
- Query historical data using measurements from Factry Historian
- Query events from Factry Historian
- Annotate graphs with event data from Factry Historian
- Use assets, measurements and events from Factry Historian as variables to build dynamic dashboards

## Installation

> A full step-by-step guide can be found in the ['Installing Factry Historian Datasource' Tutorial](https://docs.factry.cloud/docs/historian/latest/13_tutorials/installing-factry-historian-datasource/#adding-a-connection).

Install using the grafana-cli or by cloning the repository directly into the Grafana plugins directory.

```bash
grafana-cli plugins install factry-historian-datasource
```

### Configuration

Create a new instance of the data source from the Grafana Data Sources administration page. And configure the necessary settings.

![Datasource_configuration](https://github.com/factrylabs/factry-historian-datasource/blob/9d0467d5232e70957e01b265941a8c3ea2723958/src/img/datasource_configuration.png)

- URL: The URL of the Factry Historian API.
- Token: The API token to authenticate with the Factry Historian API.
- Organization: The UUID of the organization to query data from.
- Default tab: The default tab to show when opening the query editor.

## Documentation

Full documentation can be found at the Factry documentation site: [https://docs.factry.cloud/docs/grafana-datasource](https://docs.factry.cloud/docs/grafana-datasource)
