import { Button, DatePicker, Dropdown, Form, Image, Input, Modal, Select, Switch, Table, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const columns = [
  { title: 'Order', dataIndex: 'id' },
  { title: 'Actions', key: 'actions', render: () => <a href="#edit">Edit</a> },
];

export function Accessible({ open, canDelete }: { open: boolean; canDelete: boolean }) {
  return (
    <>
      <Button icon={<DeleteOutlined />} aria-label="Delete order" />
      <Tooltip title="Delete order">
        <Button icon={<DeleteOutlined />} aria-label="Delete order" disabled={false} />
      </Tooltip>
      {!canDelete && <p>You need delete rights to remove orders.</p>}
      <Dropdown menu={{ items: [{ key: 'rename', label: 'Rename' }] }}>
        <Button>More</Button>
      </Dropdown>
      <Form layout="vertical">
        <Form.Item label="Email" name="email">
          <Input type="email" autoComplete="email" />
        </Form.Item>
        <Form.Item label="Password" name="password">
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Country" name="country">
          <Select options={[{ value: 'pk', label: 'Pakistan' }]} />
        </Form.Item>
        <Form.Item label="Start date" name="start">
          <DatePicker />
        </Form.Item>
        <Form.Item label="Newsletter" name="newsletter" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
      <Image src="/logo.png" alt="" width={80} />
      <Table columns={columns} dataSource={[]} />
      <Modal open={open} title="Cancel order">
        Are you sure?
      </Modal>
    </>
  );
}
