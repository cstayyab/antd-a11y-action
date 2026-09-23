'use client';

import { DeleteOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';

export function Accessible() {
  return (
    <Form layout="vertical">
      <Form.Item label="Search orders" name="q">
        <Input />
      </Form.Item>
      <Button icon={<DeleteOutlined />} aria-label="Delete order" />
    </Form>
  );
}
