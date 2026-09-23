'use client';

import { Button, Form, Input } from 'antd';
import { useRouter } from 'next/navigation';

// Fake sign-in for the self-test: any credentials set a session cookie.
export default function Login() {
  const router = useRouter();
  return (
    <>
      <h1>Sign in</h1>
      <Form
        layout="vertical"
        onFinish={() => {
          document.cookie = 'session=ok; path=/';
          router.push('/account');
        }}
      >
        <Form.Item label="Username" name="username" rules={[{ required: true }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Sign in
        </Button>
      </Form>
    </>
  );
}
