# <img src="https://raw.githubusercontent.com/factrylabs/factry-historian-datasource/main/src/img/logo.svg" alt="Factry Historian Logo" height="30"> Factry Historian Datasource

[Grafana](https://grafana.com) datasource for [Factry Historian](https://factry.io).

## Introduction

Empower anyone to analyze industrial process and event data with Grafana. The Grafana Data Source for Factry Historian makes it easy for users to browse assets, trend time-series and event data such as batches or shifts – with zero technical skills required.

## Typical use cases

- Browsing your asset structure (e.g. ISA88/ISA95 equipment model)
- Trending time-series data, while auto-configuring units of measurement
- Overlaying of events (e.g. golden batch analysis)
- Ad-hoc overlaying of time-series data on top of events

## Features

- Query historical data using the asset tree defined in Factry Historian
- Query historical data using measurements from Factry Historian
- Autoload Units of Measurement, Y-axis scaling and HI/LO boundaries
- Query Events from Factry Historian (e.g. batches, CIP cycles)
- Annotate trends with Event data from Factry Historian
- Use assets, measurements and events from Factry Historian as variables to build dynamic dashboards

## Installation

> A full step-by-step guide can be found in the ['Installing Factry Historian Datasource' Tutorial](https://docs.factry.cloud/docs/historian/latest/13_tutorials/installing-factry-historian-datasource/#adding-a-connection).

Install using the grafana-cli or by cloning the repository directly into the Grafana plugins directory.

```bash
grafana-cli plugins install factry-historian-datasource
```

### Configuration

Create a new instance of the data source from the Grafana Data Sources administration page. And configure the necessary settings.

![Datasource_configuration](https://raw.githubusercontent.com/factrylabs/factry-historian-datasource/main/src/img/datasource_configuration.png)

- URL: The URL of the Factry Historian API.
- Token: The API token to authenticate with the Factry Historian API.
- Organization: The UUID of the organization to query data from.
- Default tab: The default tab to show when opening the query editor.

## Documentation

Full documentation can be found at the Factry documentation site: [https://docs.factry.cloud/docs/grafana-datasource](https://docs.factry.cloud/docs/grafana-datasource/latest)
