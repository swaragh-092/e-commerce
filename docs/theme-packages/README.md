# Author a Swaragh theme package

Use the [v3 examples](examples) to start a package for Home, Product, Category, or Wishlist. Each example is a complete importable package. The Home example uses a `fruit` category slug. Replace it with the slug for your catalog before previewing that row.

## Enable autocomplete in VS Code

Add this association to your workspace settings and open a `.theme.json` file.

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/*.theme.json"],
      "url": "./docs/theme-packages/theme-package.schema.json"
    }
  ]
}
```

Keep the association in editor settings so the uploaded package contains only fields accepted by the importer.

## Validate before upload

From the repository root, run the server validator after installing server dependencies.

```sh
node server/src/scripts/validateThemePackage.js docs/theme-packages/examples/wishlist.theme.json
```

The [JSON Schema](theme-package.schema.json) provides autocomplete and checks shape, known fields, common value limits, and supported section conditions. The server validator also checks custom rules, normalized input, references, and API Builder policy. A server validation error identifies the field path and describes the rejected value or rule.

## Update the schema as the package evolves

Run `node server/src/scripts/generateThemeJsonSchema.js` from the repository root after changing the backend package schema. The theme package tests check that the generated file is current and that every example passes the real import validator.
