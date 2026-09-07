export const DISCOVERY_QUALITY_CASES = [
  {
    id: 'structured-pruning',
    intent:
      'Find recent arXiv papers and public GitHub implementations of structured channel pruning for efficient neural network inference on edge devices.',
    rubric:
      'Direct: structured/channel/filter pruning with concrete neural network efficiency relevance. Partial: broader model compression or edge inference with an identifiable connection. Off-topic: unrelated classification, generic agents, or efficiency without pruning/compression relevance.'
  },
  {
    id: 'energy-aware-training',
    intent: '寻找基于实际硬件能耗或碳强度、在完成期限约束下调度机器学习训练任务的论文及开源代码。',
    rubric:
      'Direct: ML training scheduling constrained by energy/carbon and completion/deadline requirements. Partial: measured ML energy/carbon, cluster scheduling, or deadline-aware training missing part of that conjunction. Off-topic: generic model training or environmental discussion without computing energy/scheduling relevance.'
  },
  {
    id: 'residential-demand-response',
    intent:
      'Find research papers and public implementations of price-based residential demand response that jointly model electricity bills and user comfort constraints.',
    rubric:
      'Direct: residential price-responsive electricity scheduling with cost/bills and comfort constraints. Partial: demand response, dynamic pricing, or home energy management without both constraints. Off-topic: general time series forecasting, unrelated demand prediction or generic LLM agents.'
  }
] as const
