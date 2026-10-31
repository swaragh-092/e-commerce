# Menu child pagination

In **Content → Menu Builder**, edit a parent item and choose **Children per batch** (5, 10, 20, 30, 50, or 100). **Show all** clears the limit and preserves the previous behavior. The public API also accepts any integer from 1 to 100 for `childDisplayLimit`. An existing custom value remains selectable in the editor.

The setting applies to that item's immediate children. For synced category branches it also applies to each generated level. Manually added descendants can have their own limits. Admin menu reads always return the complete tree so editing and reordering continue to work.

## Initial public response

Both `GET /api/menus/public/:location` and `GET /api/menus/slug/public/:slug` retain their existing response envelope. When a parent has a limit, its `children` array contains the first batch and it includes:

```json
{
  "childrenPagination": {
    "total": 100,
    "offset": 0,
    "limit": 10,
    "hasMore": true,
    "nextOffset": 10
  }
}
```

Use the returned parent's `menuId` and `id` to request more children. Generated category IDs are opaque strings: URL-encode the whole ID rather than splitting it.

## Load the next batch

`GET /api/menus/public/:menuId/items/:itemId/children?offset=10&limit=10`

The response uses the usual `{ success, data, message }` envelope. `data` contains `items` and `pagination` with the same fields above. Append `items` to the parent's existing children. Continue with `nextOffset` until `hasMore` is false (`nextOffset` is then null). Each returned child may have its own `childrenPagination`.

`offset` defaults to zero and must be an integer from 0 to 1,000,000. `limit` defaults to the parent's configured batch size, or 30 for an unlimited parent, and must be an integer from 1 to 100. Inactive menus and non-public items return 404. Rate limits match the existing public menu routes.

Ordering follows the menu/category ordering used by the initial response. Offset pages reflect the current tree; if an admin changes the order during browsing, reload the menu to start from its updated order.

## Deployment

Run `npm run migrate --prefix server` before starting the updated server. The migration adds nullable `menu_items.child_display_limit`; existing menus continue showing all items. No menu records are rewritten.

The server still builds the existing full menu tree internally before selecting the response batch. This reduces public response/render size; it does not implement database-level lazy traversal.
