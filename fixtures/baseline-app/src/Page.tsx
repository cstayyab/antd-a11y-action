// Baseline fixture: three identical unnamed InputNumbers (the baseline counts two), a Modal without a
// title (baselined) and an unnamed Select (not in the baseline, so new).
import { InputNumber, Modal, Select } from 'antd';

export function Page({ open }: { open: boolean }) {
  return (
    <>
      <InputNumber />
      <InputNumber />
      <InputNumber />
      <Modal open={open} />
      <Select options={[]} />
    </>
  );
}
