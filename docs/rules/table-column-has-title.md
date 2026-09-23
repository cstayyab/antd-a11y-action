# antd-a11y/table-column-has-title

Every `Table` column needs a non-empty `title`, so its header cell isn't empty.

**Impact:** moderate
**WCAG:** 1.3.1 Info and Relationships

Screen readers read a cell's column header as they move through a table. An empty `<th>`, typically on an actions column, leaves that column unexplained.

The rule checks `columns` given as an inline array or as a `const` array in the same file, including nested `children` groups, plus `<Table.Column>` and `<Table.ColumnGroup>` elements. It skips columns with spreads, `hidden: true`, and column lists built at runtime.

## Fails

```jsx
const columns = [
  { title: 'Order', dataIndex: 'id' },
  { key: 'actions', render: (_, row) => <RowActions row={row} /> },
];
```

## Passes

```jsx
{ title: 'Actions', key: 'actions', render: … }
{ title: <span className="sr-only">Actions</span>, key: 'actions', render: … }
```
