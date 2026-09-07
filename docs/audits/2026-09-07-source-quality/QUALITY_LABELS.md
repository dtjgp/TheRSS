# Top-10 助手相关性审阅

2026-09-07；仅依据本轮保存的完整摘要、仓库描述和主题。0=不相关，1=部分相关，2=直接满足题目。标签不是独立人工真值，也不评价论文方法或代码质量。训练题的直接相关要求同时体现 ML 训练、能耗/碳和期限；居民题的舒适包括明确的用户使用扰动约束。

## structured-pruning:codex

Find recent arXiv papers and public GitHub implementations of structured channel pruning for efficient neural network inference on edge devices.

| 排名 | 来源记录                                                                                                                                                                     | 标签 | 依据                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| 1    | [APQF: Agentic Profiling-Guided Structured Pruning and Mixed-Precision Quantization with Adaptive Fine-Tuning](https://arxiv.org/abs/2608.05499v1)                           | 2    | 明确结合结构化剪枝、混合精度与边缘网络效率。      |
| 2    | [InterPruner: Interactive Structured Pruning via Taylor-Implicit Criterion and Language-Prior Modulator for Multimodal Object Detection](https://arxiv.org/abs/2608.10724v1) | 2    | 明确研究 RGB-IR 检测器的结构化通道剪枝。          |
| 3    | [Sustainable Edge Vision via Empirically Calibrated DVFS: Eliminating Thermal Throttling on Passively Cooled Hardware](https://arxiv.org/abs/2609.04705v1)                   | 1    | 边缘 DNN 的 DVFS 能效与热调度相关，但没有剪枝。   |
| 4    | [Deep Microcompression: Structured Pruning and Bit-packed Quantization for Microcontrollers](https://arxiv.org/abs/2609.05081v1)                                             | 2    | 微控制器管线明确结合结构化剪枝和量化。            |
| 5    | [Breaking the Compression Barrier: Cross-Architecture Compression Boundary Learning via Reverse Regrowth](https://arxiv.org/abs/2608.16010v1)                                | 2    | 恢复压缩边界，同时报告结构化剪枝实验。            |
| 6    | [COEC: Calibrated Orthogonal-Equivalence Compensation for Structured Pruning of Large Language Models](https://arxiv.org/abs/2608.21142v1)                                   | 2    | 结构化列剪枝后的 LLM 补偿，直接关联推理成本。     |
| 7    | [VisAdj: Learning Adjacency Matrices from Node-Link Images](https://arxiv.org/abs/2608.21825v1)                                                                              | 0    | 从图像恢复图邻接矩阵；edge 指图边，没有模型压缩。 |
| 8    | [CST: Collaborative Selective Transmission for Communication-Efficient Multimodal Edge Inference](https://arxiv.org/abs/2608.22115v1)                                        | 1    | 边缘推理的特征传输压缩相关，但不是网络通道剪枝。  |
| 9    | [PruneShift: A Framework for Evaluating Decision Reliability in Structured Pruning](https://arxiv.org/abs/2608.29765v1)                                                      | 2    | 直接评估结构化剪枝中掩码选择的可靠性。            |
| 10   | [Vision Token Manipulation Attacks on Cloud-Edge Inference of Large Vision-Language Models](https://arxiv.org/abs/2607.02819v1)                                              | 0    | 云边视觉 token 安全攻击，没有剪枝或压缩效率方法。 |

## structured-pruning:claude

Find recent arXiv papers and public GitHub implementations of structured channel pruning for efficient neural network inference on edge devices.

| 排名 | 来源记录                                                                                                                                                   | 标签 | 依据                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| 1    | [H3DNAS: Hardware-Aware ONNX-Native 3D Point Cloud Model Compression](https://arxiv.org/abs/2609.02684v1)                                                  | 2    | ONNX 图手术明确采用通道选择并报告边缘推理加速。       |
| 2    | [On the Interaction Between Model Compression and Test-Time Adaptation](https://arxiv.org/abs/2609.03604v1)                                                | 1    | 结构化模型压缩与适应性相关，但摘要未确认通道剪枝。    |
| 3    | [CutClean: Neural Network Pruning for Privacy-Preserving Inference](https://arxiv.org/abs/2608.13773v1)                                                    | 1    | 隐私目标的神经网络稀疏化，未明确结构化通道与成本。    |
| 4    | [VisAdj: Learning Adjacency Matrices from Node-Link Images](https://arxiv.org/abs/2608.21825v1)                                                            | 0    | 图拓扑恢复中的稀疏邻居采样，没有网络模型压缩。        |
| 5    | [intel/neural-compressor](https://github.com/intel/neural-compressor)                                                                                      | 1    | 压缩、稀疏与 pruning 主题相关，描述未确认结构化通道。 |
| 6    | [SonySemiconductorSolutions/mct-model-optimization](https://github.com/SonySemiconductorSolutions/mct-model-optimization)                                  | 1    | 硬件约束的模型量化压缩工具，未说明通道剪枝。          |
| 7    | [nikolareljin/shrink-llm](https://github.com/nikolareljin/shrink-llm)                                                                                      | 1    | 手机部署的压缩剪枝工具，未说明结构化通道方法。        |
| 8    | [saadhvik/orbit-8](https://github.com/saadhvik/orbit-8)                                                                                                    | 1    | CNN 压缩与推理效率相关，未明确结构化剪枝。            |
| 9    | [Sustainable Edge Vision via Empirically Calibrated DVFS: Eliminating Thermal Throttling on Passively Cooled Hardware](https://arxiv.org/abs/2609.04705v1) | 1    | 边缘 DNN 的 DVFS 能效与热调度相关，但没有剪枝。       |
| 10   | [FasterAI-Labs/fasterai](https://github.com/FasterAI-Labs/fasterai)                                                                                        | 1    | 神经网络剪枝与蒸馏工具，描述未确认结构化通道。        |

## energy-aware-training:codex

寻找基于实际硬件能耗或碳强度、在完成期限约束下调度机器学习训练任务的论文及开源代码。

| 排名 | 来源记录                                                                                                                                   | 标签 | 依据                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| 1    | [Green or Fast? Learning to Balance Cold Starts and Idle Carbon in Serverless Computing](https://arxiv.org/abs/2602.23935v1)               | 1    | 碳感知 serverless 资源保留调度，不是带期限的 ML 训练。        |
| 2    | [InFactPlanner: Planning Sustainable Geo-Distributed LLM Data Centers](https://arxiv.org/abs/2608.12915v1)                                 | 1    | LLM 推理的能耗碳排与部署规划，缺少训练和期限。                |
| 3    | [CarbonSim: A Lifecycle-Aware Framework for Evaluating Carbon Tradeoffs in Hardware Upgrade Decisions](https://arxiv.org/abs/2606.06438v1) | 1    | 计算硬件碳核算与调度相关，缺少 ML 训练期限。                  |
| 4    | [nirholas/x402-carbon](https://github.com/nirholas/x402-carbon)                                                                            | 0    | 碳强度数据与最佳时间窗服务，未提供计算任务调度证据。          |
| 5    | [peterklingelhofer/carbon-aware-dispatcher](https://github.com/peterklingelhofer/carbon-aware-dispatcher)                                  | 1    | 按碳强度调度 CI/CD 计算任务，未涉及 ML 训练期限。             |
| 6    | [akshaya-cin19/Green-Cloud-Optimizer](https://github.com/akshaya-cin19/Green-Cloud-Optimizer)                                              | 1    | 描述涉及云计算任务的碳感知调度，但仅页面/数据库且无训练期限。 |
| 7    | [fabiocicerchia/carbon-region-picker](https://github.com/fabiocicerchia/carbon-region-picker)                                              | 1    | 按碳强度选择云区域，关联计算部署但没有训练调度。              |
| 8    | [FergalSlime06/carbon-intensity-dashboard](https://github.com/FergalSlime06/carbon-intensity-dashboard)                                    | 0    | 电网碳强度图表，没有计算任务调度。                            |
| 9    | [Muhammad-Haris-3/GridCast](https://github.com/Muhammad-Haris-3/GridCast)                                                                  | 0    | 电网碳强度预测，没有计算任务调度。                            |
| 10   | [tybradf/gridflex](https://github.com/tybradf/gridflex)                                                                                    | 0    | 电网灵活需求价值分析，没有计算或 ML 训练任务。                |

## energy-aware-training:claude

寻找基于实际硬件能耗或碳强度、在完成期限约束下调度机器学习训练任务的论文及开源代码。

| 排名 | 来源记录                                                                                                                                 | 标签 | 依据                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| 1    | [CASPER: Carbon-Aware Scheduling and Provisioning for Distributed Web Services](https://arxiv.org/abs/2403.14792v1)                      | 1    | 带延迟约束的 Web 服务碳调度，不是 ML 训练期限。           |
| 2    | [The Sunk Carbon Fallacy: Rethinking Carbon Footprint Metrics for Effective Carbon-Aware Scheduling](https://arxiv.org/abs/2410.15087v1) | 1    | 计算任务调度的碳核算方法，未明确训练和期限。              |
| 3    | [GreenScale: Carbon-Aware Systems for Edge Computing](https://arxiv.org/abs/2304.00404v1)                                                | 1    | 边云应用碳调度包含 AI，但未明确训练和期限。               |
| 4    | [Clover: Toward Sustainable AI with Carbon-Aware Machine Learning Inference Service](https://arxiv.org/abs/2304.09781v2)                 | 1    | ML 推理的碳、性能与 SLA 调度，任务为推理而非训练。        |
| 5    | [GreenCourier: Carbon-Aware Scheduling for Serverless Functions](https://arxiv.org/abs/2310.20375v1)                                     | 1    | serverless 函数的碳调度，不是 ML 训练期限。               |
| 6    | [MetaFed: Advancing Privacy, Performance, and Sustainability in Federated Metaverse Systems](https://arxiv.org/abs/2508.17341v3)         | 1    | 联邦学习与碳感知调度相关，未提供完成期限约束。            |
| 7    | [CarbonEdge: Carbon-Aware Deep Learning Inference Framework for Sustainable Edge Computing](https://arxiv.org/abs/2603.27420v2)          | 1    | 碳感知深度学习推理调度，缺少训练期限。                    |
| 8    | [Night-Window Batching versus Carbon-Aware Scheduling for Clinical AI GPU Workloads](https://arxiv.org/abs/2606.01766v1)                 | 1    | ML GPU 作业的碳与期限模拟，但未确认任务为训练或实际测量。 |
| 9    | [EcoKube: Simulating Carbon-Aware Scheduling Policies in Heterogeneous Edge-Cloud Environments](https://arxiv.org/abs/2607.09318v1)      | 1    | 边云碳调度模拟，使用合成批任务且没有训练期限。            |
| 10   | [jesicasabau1212/The-Sustainable-Queue](https://github.com/jesicasabau1212/The-Sustainable-Queue)                                        | 1    | 延迟灵活计算任务到低碳窗口，未说明 ML 训练期限。          |

## residential-demand-response:codex

Find research papers and public implementations of price-based residential demand response that jointly model electricity bills and user comfort constraints.

| 排名 | 来源记录                                                                                                                                                                         | 标签 | 依据                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| 1    | [Time-of-use Pricing for Energy Storage Investment](https://arxiv.org/abs/2112.06358v3)                                                                                          | 1    | 分时电价与储能投资，缺少用户舒适约束。                 |
| 2    | [Development and Evaluation of an Online Home Energy Management Strategy for Load Coordination in Smart Homes with Renewable Energy Sources](https://arxiv.org/abs/2304.11770v1) | 2    | 住宅负荷协调同时优化电费并限制延后负荷的使用扰动。     |
| 3    | [Economic evaluation of stochastic home energy management systems in a realistic rolling horizon setting](https://arxiv.org/abs/2203.08639v1)                                    | 1    | 真实零售电价下家庭 PV/电池经济调度，未明确舒适约束。   |
| 4    | [A Semi Empirical Approach to a Physically Based Aging Model for Home Energy Management Systems](https://arxiv.org/abs/2206.06158v1)                                             | 1    | 家庭能源控制中的电池老化模型，未联合电价与舒适约束。   |
| 5    | [Optimal Storage and Solar Capacity of a Residential Household under Net Metering and Time-of-Use Pricing](https://arxiv.org/abs/2207.04635v4)                                   | 1    | 居民分时电价下储能与光伏投资，缺少舒适约束。           |
| 6    | [Peer-to-Peer Sharing of Energy Storage Systems under Net Metering and Time-of-Use Pricing](https://arxiv.org/abs/2207.12022v2)                                                  | 1    | 居民共享储能与分时电价成本分配，缺少舒适约束。         |
| 7    | [Smart Home Energy Management: VAE-GAN synthetic dataset generator and Q-learning](https://arxiv.org/abs/2305.08885v1)                                                           | 1    | 用于家庭能管的合成数据与 Q-learning，未明确舒适约束。  |
| 8    | [Transfer Learning in Transformer-Based Demand Forecasting For Home Energy Management System](https://arxiv.org/abs/2310.19159v1)                                                | 1    | 家庭负荷预测已连接控制和电费评估，缺少舒适约束。       |
| 9    | [Explainable Reinforcement Learning-based Home Energy Management Systems using Differentiable Decision Trees](https://arxiv.org/abs/2403.11947v1)                                | 2    | 明确家庭控制、电费节约与保持用户舒适。                 |
| 10   | [HomeLabGym: A real-world testbed for home energy management systems](https://arxiv.org/abs/2404.14110v1)                                                                        | 1    | 真实住宅能管测试床与实时电价电池控制，未明确舒适约束。 |

## residential-demand-response:claude

Find research papers and public implementations of price-based residential demand response that jointly model electricity bills and user comfort constraints.

| 排名 | 来源记录                                                                                                                                                   | 标签 | 依据                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| 1    | [MateoGreil/homeassistant-comwatt](https://github.com/MateoGreil/homeassistant-comwatt)                                                                    | 1    | 家庭能源管理集成主题相关，未提供电价和舒适模型。           |
| 2    | [MateoGreil/python-comwatt-client](https://github.com/MateoGreil/python-comwatt-client)                                                                    | 1    | 家庭能源管理 API 客户端主题相关，未提供联合约束。          |
| 3    | [sariekiriyuu/smartEMS-MultiAgent-Demo](https://github.com/sariekiriyuu/smartEMS-MultiAgent-Demo)                                                          | 0    | 一般多智能体能源演示，描述未体现居民、电价响应或舒适约束。 |
| 4    | [Does Demand Response Increase Vulnerability to Cyber Attacks by Adversarial Data Modifications?](https://arxiv.org/abs/2607.06632v1)                      | 1    | 工业需求响应与电价攻击相关，场景并非居民舒适调度。         |
| 5    | [anacodicAI-labs/carbon-aware-load-scheduling](https://github.com/anacodicAI-labs/carbon-aware-load-scheduling)                                            | 1    | EV/热泵灵活电负荷的碳调度，未联合电费与舒适约束。          |
| 6    | [Market-Information-Aware Gated-LoRA of Foundation Models for Transferable Day-Ahead Electricity Price Forecasting](https://arxiv.org/abs/2608.11359v1)    | 0    | 批发电价预测方法，未涉及居民需求响应决策。                 |
| 7    | [Deep Learning for Cross-Border Electricity Price Forecasting: A Comparative Study](https://arxiv.org/abs/2608.17091v1)                                    | 0    | 跨国电价预测比较，未涉及居民需求响应决策。                 |
| 8    | [Mitigating Regional Traffic Congestion via School Start Time Scheduling: A Bilevel Alternating Optimization Approach](https://arxiv.org/abs/2608.18785v1) | 0    | 学校通勤交通调度，demand response 不是电力需求响应。       |
| 9    | [LSTN: A Linear Model of Industrial Production Process for Demand Response](https://arxiv.org/abs/2608.25249v1)                                            | 1    | 工业生产需求响应模型，不是居民电费与舒适调度。             |
| 10   | [A causal graph-informed temporal convolution architecture for interpretable retail electricity price forecasting](https://arxiv.org/abs/2608.26234v1)     | 0    | 零售电价预测与市场分析，没有居民负荷响应决策。             |
