---
title: 'Configuration'
description: ''
draft: false
collapsible: false
weight: 2
aliases:
  - ./configuration
---

## Adding a connection

When adding a connection in Grafana you'll need the following information:

- [The Factry Historian API URL](../../../historian/v6.3/3_administration/general.md#api), usually `http://historian.mycompany.org:8000`
- [The organization UUID](../../../historian/v6.3/3_administration/organizations.md#organizations)
- [An API token](../../../historian/v6.3/3_administration/users.md#generating-an-api-token)

The organization UUID is used to determine from which organization you'll be able to fetch data.

Below we create a user group with read privileges enabled and add a grafana user to this group from which to generate the API token.

### In Factry Historian

- Create a user group with all **READ** privileges (except READ_AUDIT_LOGS) in the according Historian organization.
  - Go to Factry Historian,
  - Click on `Configuration` and then `Groups`,
  - Click on `Create user group` and give the user group a name f.e. "factry-historian-readers",
  - Click on the edit button and edit the `Privileges`
- Create a user and add it to the newly created group.
  - To add a new user click on `Configuration` then `Users`,
  - Click on `Add new user` button,
  - Fill in the fields and submit,
  - Go back to `Groups` settings and add the user to the group using `Users` section
- Create a token for the newly created user.
  - Go to `Users` settings and click on the edit button for the newly created user,
  - Navigate to `Tokens` tab,
  - Click on `Generate API token` button

### In Grafana

- Create a new datasource.
- Fill in the **URL**. This is the same as the Factry Historian API URL from above, f.e. http://historian.mycompany.org:8000.
- Fill in the according organization UUID.
  - To find the organization UUID, go to Factry Historian,
  - Click on `Organizations`,
  - Click on the edit button of the organization and copy the `ID`.
- Fill in the token generated in the Historian for the specific user and paste it in Grafana.
- Select the default query type to open when creating a new query
- Click `Save & test`, when successful this should return how many timeseries databases are found
