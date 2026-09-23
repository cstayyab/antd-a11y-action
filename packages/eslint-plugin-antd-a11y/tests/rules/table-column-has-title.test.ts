import rule from '../../src/rules/table-column-has-title.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };

run('table-column-has-title', rule, {
  valid: [
    w(`<Table columns={[{ title: 'Name', dataIndex: 'name' }]} />`),
    w(`const columns = [{ title: 'Name', dataIndex: 'name' }, { title: t('actions'), key: 'a' }]; <Table columns={columns} />`),
    w(`<Table columns={getColumns()} />`),
    w(`<Table columns={cols} />`),
    w(`<Table columns={[{ ...base }, Table.SELECTION_COLUMN]} />`),
    w(`<Table columns={[{ key: 'x', hidden: true }]} />`),
    w(`<Table><Table.Column title="Name" dataIndex="name" /></Table>`),
    w(`let columns = [{ key: 'x' }]; <Table columns={columns} />`),
    `import { Table } from 'rc-table'; <Table columns={[{ key: 'x' }]} />`,
  ],
  invalid: [
    { code: w(`<Table columns={[{ title: 'Name' }, { key: 'actions', render: r }]} />`), errors: [error] },
    { code: w(`const columns = [{ title: '', key: 'a' }]; <Table columns={columns} />`), errors: [error] },
    { code: w(`const columns: ColumnsType<Row> = [{ title: 'Name' }, { key: 'a' }] as const; <Table columns={columns} />`), errors: [error] },
    { code: w(`<Table columns={[{ title: 'Group', children: [{ dataIndex: 'x' }] }]} />`), errors: [error] },
    { code: w(`<Table><Table.Column dataIndex="actions" /></Table>`), errors: [error] },
  ],
});
