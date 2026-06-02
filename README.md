#小林coding出品！！！！



# ai-oncall-assistant

智能值班小助手 — 基于 Spring Boot 构建的 AI 运维问答平台。

## 能力一览

**RAG 智能问答**
- Milvus 向量数据库驱动
- 阿里云 DashScope 大模型加持
- 多轮对话 + 流式输出

**AIOps 自动化运维**
- 多 Agent 协作编排
- 告警分析 + 日志查询 + 诊断报告
- Planner → Executor → Replanner 闭环

**配套能力**
- 文档上传 + 自动向量化
- 会话历史管理
- RESTful API 完整暴露

## 跑起来

**前置依赖**

| 依赖 | 版本 |
|------|------|
| JDK | 17+ |
| Maven | 3.8+ |
| Docker | 20.10+ |
| DashScope API Key | 阿里云控制台获取 |

**启动步骤**

```bash
# 1. 克隆后先配 Key
export DASHSCOPE_API_KEY=your-key-here

# 2. 启动向量数据库
docker-compose up -d -f vector-database.yml

# 3. 编译启动
mvn clean install
mvn spring-boot:run
```

**启动后访问**

| 服务 | 地址 |
|------|------|
| Web UI | http://localhost:9900 |
| 向量库健康 | http://localhost:9900/milvus/health |
| Attu 管理台 | http://localhost:8000 |

## API 速查

```bash
# 流式问答（推荐）
curl -X POST http://localhost:9900/api/chat_stream \
  -H "Content-Type: application/json" \
  -d '{"Id":"test","Question":"介绍一下系统架构"}'

# 普通问答
curl -X POST http://localhost:9900/api/chat \
  -H "Content-Type: application/json" \
  -d '{"Id":"test","Question":"介绍一下系统架构"}'

# AIOps 分析
curl -X POST http://localhost:9900/api/ai_ops

# 上传知识库文档
curl -X POST http://localhost:9900/api/upload \
  -F "file=@your-doc.md"
```

## 技术栈

```
Java 17
Spring Boot 3.2.0
Spring AI 1.1.0
Alibaba DashScope SDK 2.17.0
Milvus SDK Java 2.6.10
Milvus Server 2.5.10
```

## 项目结构

```
src/main/java/org/example/
├── controller/         # REST 接口层
├── service/           # 核心业务逻辑
├── agent/tool/        # Agent 工具集
├── config/            # Spring 配置
├── client/            # 外部服务客户端
└── dto/               # 数据传输对象

src/main/resources/
├── static/            # 前端资源
└── application.yml    # 主配置
```

## 踩坑备忘

- DashScope API Key 必须配置（环境变量或 `application-local.yml`）
- Milvus 首次启动需等待约 1 分钟完全就绪
- 上传文档仅支持 `.txt` 和 `.md` 格式
