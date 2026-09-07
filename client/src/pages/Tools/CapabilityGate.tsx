import React from 'react';
import { Link } from 'react-router-dom';
import type { TaskType } from '../../../../shared/api.interface';
import { productCapabilityFor } from '../../../../shared/product-capability.catalog';

export type CapabilityGateState =
  | { kind: 'production' }
  | { kind: 'preview' }
  | { kind: 'disabled'; replacementRoute: string };

export function getCapabilityGateState(type: TaskType): CapabilityGateState {
  const capability = productCapabilityFor(type);
  if (capability?.readiness === 'production') return { kind: 'production' };
  if (capability?.readiness === 'disabled') {
    return {
      kind: 'disabled',
      replacementRoute: capability.replacementRoute ?? '/tools',
    };
  }
  return { kind: 'preview' };
}

interface CapabilityGateProps {
  type: TaskType;
  children: React.ReactNode;
}

const CapabilityGate: React.FC<CapabilityGateProps> = ({ type, children }) => {
  const state = getCapabilityGateState(type);
  if (state.kind === 'production') return <>{children}</>;

  if (state.kind === 'disabled') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-lg font-semibold">该工具已下线</h2>
        <p className="mt-2 text-sm leading-relaxed">
          虚构文献不能作为真实文献推荐结果提供，请使用 Academic Search 获取真实发现结果。
        </p>
        <Link
          to={state.replacementRoute}
          className="mt-4 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          前往 Academic Search →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
      <h2 className="text-lg font-semibold">功能预览中</h2>
      <p className="mt-2 text-sm leading-relaxed">
        该工具当前仅展示产品方向，尚未开放任务提交。
      </p>
    </div>
  );
};

export default CapabilityGate;
