import { Image, Modal, Table } from 'antd';

// modal-has-title, table-column-has-title, image-has-alt
const columns = [
  { title: 'Order', dataIndex: 'id' },
  { key: 'actions', render: () => <a href="#edit">Edit</a> },
];

export function Orders({ open }: { open: boolean }) {
  return (
    <>
      <Image src="/logo.png" width={80} />
      <Table columns={columns} dataSource={[]} />
      <Modal open={open}>Are you sure you want to cancel this order?</Modal>
    </>
  );
}
