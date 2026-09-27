"""Foundation documents: Azure AI Foundry."""

NOTE = '<p class="note">Sample foundation document written for testing a domain-expert RAG. Azure AI Foundry evolves quickly and product names have changed over time; confirm details in the official Microsoft Learn documentation.</p>'

PLATFORM = """
<h1>Azure AI Foundry Platform Overview</h1>
<p class="meta">Azure AI Foundry guide, volume 1 · Version 2026.1</p>
""" + NOTE + """
<h2>1. What Azure AI Foundry is</h2>
<p>Azure AI Foundry is Microsoft's platform for building, evaluating and operating generative AI applications and agents on Azure. It brings together a model catalog, model deployments, playgrounds, prompt and agent tooling, evaluation, content safety and monitoring in one portal and SDK. It was previously known as Azure AI Studio. Azure OpenAI Service models are available through it alongside models from other providers.</p>

<h2>2. Resource model</h2>
<p>Foundry organises work into <b>projects</b>. A project is where a team keeps its deployments, agents, data, evaluations and connections.</p>
<table>
<tr><th>Concept</th><th>What it is</th><th>Notes</th></tr>
<tr><td>Foundry resource and project</td><td>The current default: projects created on an Azure AI Foundry resource</td><td>Supports the agent service, models and evaluations with simpler setup</td></tr>
<tr><td>Hub</td><td>A shared resource that groups hub-based projects and centralises networking, compute, storage and connections</td><td>Used for features that need hub-based projects, such as some prompt flow and managed compute scenarios</td></tr>
<tr><td>Hub-based project</td><td>A project that inherits security and connections from its hub</td><td>Isolates each team's work while sharing governance</td></tr>
<tr><td>Connection</td><td>A stored link to another service, such as Azure AI Search, storage or an external API</td><td>Prefer Microsoft Entra ID (managed identity) over keys</td></tr>
</table>
<p><b>Hub versus project, in short:</b> the hub is the administrative and security boundary set up by the platform team (network isolation, shared compute, storage and key vault, shared connections); projects are the workspaces where developers build. Many teams can have projects under one hub without seeing each other's work.</p>

<h2>3. Identity and access</h2>
<p>Use Microsoft Entra ID for users and managed identities for services. Azure role-based access control (RBAC) governs who can create deployments, run evaluations or manage the resource; built-in roles include owner and contributor roles for administration and developer or user roles for building within a project. Grant developers project-level roles rather than subscription-wide ones. Disable key-based authentication where possible and let applications call models with their managed identity.</p>

<h2>4. Networking</h2>
<p>For production, disable public network access and use private endpoints so traffic to the Foundry resource, Azure OpenAI, Azure AI Search and storage stays on your virtual network. Hubs can use a managed virtual network with outbound rules that allow only approved destinations. Combine with Azure Firewall or network security groups for egress control and with Azure Policy to enforce these settings across subscriptions.</p>

<h2>5. The model catalog</h2>
<p>The model catalog lists models from Microsoft and Azure OpenAI and from providers such as Meta (Llama), Mistral, Cohere and others, plus Microsoft's small Phi models. Each model card shows capabilities, benchmarks, licence and supported deployment options. Model benchmarks and leaderboards in the portal help compare quality, cost and throughput before choosing.</p>

<h2>6. Deployment options</h2>
<table>
<tr><th>Deployment type</th><th>How it works</th><th>Choose when</th></tr>
<tr><td>Standard</td><td>Pay per token; processing in the resource's region</td><td>Development and moderate production traffic with regional data processing</td></tr>
<tr><td>Global Standard</td><td>Pay per token; requests routed across Azure's global capacity</td><td>Highest default quota and availability when data may be processed in any region</td></tr>
<tr><td>Data Zone Standard</td><td>Pay per token within a geographic zone such as the EU or US</td><td>Data residency within a zone with better capacity than single-region</td></tr>
<tr><td>Provisioned (PTU)</td><td>Reserved throughput units billed hourly or by reservation</td><td>Predictable high volume and consistent latency</td></tr>
<tr><td>Batch</td><td>Asynchronous jobs at a lower price, returned within a target window</td><td>Large offline workloads such as document enrichment</td></tr>
<tr><td>Serverless API (models as a service)</td><td>Pay-per-token hosting of catalog models from other providers</td><td>Open or partner models without managing compute</td></tr>
<tr><td>Managed compute</td><td>Dedicated virtual machines host the model</td><td>Custom or fine-tuned open models needing full control</td></tr>
</table>
<p><b>Choosing for an Azure OpenAI model:</b> start with Global Standard for the best availability if your compliance rules allow processing anywhere; use Data Zone or Standard when data must stay in a zone or region; move to Provisioned when traffic is steady and you need guaranteed throughput and predictable latency.</p>

<h2>7. Quotas</h2>
<p>Pay-per-token deployments have quotas expressed in tokens per minute (TPM) and requests per minute (RPM) per model and region. Assign quota across deployments deliberately, handle HTTP 429 responses with retry and backoff, and monitor usage in Azure Monitor.</p>

<h2>8. SDKs and APIs</h2>
<p>Applications use the Azure AI Foundry SDK (for example the <code>azure-ai-projects</code> package for projects, agents, evaluations and connections, and model inference clients) or the OpenAI-compatible Azure OpenAI endpoints. Authenticate with <code>DefaultAzureCredential</code> so the same code uses a developer's login locally and a managed identity in Azure.</p>
<pre>
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

project = AIProjectClient(endpoint=PROJECT_ENDPOINT, credential=DefaultAzureCredential())
</pre>
"""

RAG_AGENTS = """
<h1>Building RAG Apps and Agents on Azure AI Foundry</h1>
<p class="meta">Azure AI Foundry guide, volume 2 · Version 2026.1</p>
""" + NOTE + """
<h2>1. RAG architecture on Azure</h2>
<table>
<tr><th>Component</th><th>Azure service</th></tr>
<tr><td>Document storage</td><td>Azure Blob Storage or Data Lake</td></tr>
<tr><td>Parsing and OCR</td><td>Azure AI Document Intelligence (layout, tables, forms)</td></tr>
<tr><td>Chunking and embedding</td><td>Azure AI Search integrated vectorisation or your own pipeline with an embedding model deployment</td></tr>
<tr><td>Index and retrieval</td><td>Azure AI Search: keyword, vector, hybrid and semantic ranking</td></tr>
<tr><td>Generation</td><td>A chat model deployment in Foundry</td></tr>
<tr><td>Safety</td><td>Azure AI Content Safety and Foundry content filters</td></tr>
<tr><td>Evaluation and monitoring</td><td>Foundry evaluations, tracing and Azure Monitor / Application Insights</td></tr>
</table>

<h2>2. Azure AI Search for retrieval</h2>
<p>Azure AI Search stores documents in an index with fields for text, vectors and metadata. <b>Hybrid search</b> runs keyword (BM25) and vector queries together and merges them with reciprocal rank fusion. The <b>semantic ranker</b> re-scores the top results with a language model and can return captions and answers. Filters on metadata fields enforce security trimming, for example returning only documents whose group field matches the caller's groups. Integrated vectorisation can chunk and embed data during indexing using indexers and skillsets.</p>

<h2>3. Grounding a chat model on your data</h2>
<ol>
<li>Upload documents to storage and create a search index, with vector fields and metadata.</li>
<li>Deploy an embedding model and a chat model in the Foundry project.</li>
<li>Connect Azure AI Search to the project with managed identity.</li>
<li>In the playground or code, retrieve passages with hybrid search plus semantic ranking and pass them to the chat model with instructions to cite sources.</li>
<li>Apply filters for security trimming and add a content filter configuration to the deployment.</li>
<li>Evaluate groundedness and relevance before release and monitor them in production.</li>
</ol>

<h2>4. Prompt flow</h2>
<p>Prompt flow is a development tool for LLM workflows. A <b>flow</b> is a graph of nodes: LLM calls, Python functions, prompts and tools. Variants let you compare prompt versions; batch runs execute a flow over a dataset; evaluation flows score the outputs. Flows can be deployed as online endpoints. Prompt flow is most associated with hub-based projects; newer agent and evaluation features are available directly in Foundry projects.</p>

<h2>5. Azure AI Foundry Agent Service</h2>
<p>The Foundry Agent Service hosts agents that combine a model, instructions and tools, and manages conversation state in threads so the application does not have to.</p>
<table>
<tr><th>Tool</th><th>Use</th></tr>
<tr><td>File search</td><td>Retrieval over uploaded files with a managed vector store</td></tr>
<tr><td>Azure AI Search</td><td>Grounding on an existing enterprise index</td></tr>
<tr><td>Grounding with Bing Search</td><td>Current web information, with citations</td></tr>
<tr><td>Code interpreter</td><td>Run Python in a sandbox for analysis and charts</td></tr>
<tr><td>Function calling</td><td>Call your own code with typed arguments</td></tr>
<tr><td>OpenAPI tools</td><td>Call REST APIs described by an OpenAPI specification</td></tr>
<tr><td>Connected agents / multi-agent</td><td>Delegate sub-tasks to other agents</td></tr>
</table>
<p>A run processes a thread: the agent decides which tools to call, the service executes built-in tools, and your code handles function calls. Store secrets in Key Vault connections, give each agent's tools the least access they need, and require confirmation in your application for actions with side effects.</p>

<h2>6. Tracing and monitoring</h2>
<p>Foundry integrates with OpenTelemetry-based tracing, sending traces to Application Insights so you can see each request's prompts, tool calls, token counts and latency. Production monitoring can run evaluators on a sample of live traffic and alert when groundedness, relevance or safety scores drift.</p>

<h2>7. Fine-tuning</h2>
<p>Fine-tuning is available for selected Azure OpenAI and open models. Prepare training data in the chat JSONL format, hold out a validation set, and compare the fine-tuned model with the base model on your evaluation set before deploying. Fine-tune for format, style and narrow tasks; keep facts in RAG so they stay current.</p>
"""

RESPONSIBLE = """
<h1>Responsible AI, Safety and Evaluation on Azure AI Foundry</h1>
<p class="meta">Azure AI Foundry guide, volume 3 · Version 2026.1</p>
""" + NOTE + """
<h2>1. Microsoft's Responsible AI principles</h2>
<p>Microsoft's Responsible AI Standard is built on six principles: fairness; reliability and safety; privacy and security; inclusiveness; transparency; and accountability. Foundry's safety and evaluation features are the practical tools for meeting them: map risks, measure them, mitigate them and operate with monitoring.</p>

<h2>2. Azure AI Content Safety</h2>
<table>
<tr><th>Capability</th><th>What it detects</th></tr>
<tr><td>Harm categories</td><td>Hate, sexual, violence and self-harm content in text and images, each scored by severity</td></tr>
<tr><td>Prompt Shields</td><td>User prompt attacks (jailbreaks) and document attacks (indirect prompt injection hidden in documents, emails or tool results)</td></tr>
<tr><td>Groundedness detection</td><td>Claims in a response that are not supported by the provided source documents</td></tr>
<tr><td>Protected material detection</td><td>Known copyrighted text such as song lyrics and articles, and public code</td></tr>
<tr><td>Custom categories and blocklists</td><td>Organisation-specific terms and topics</td></tr>
</table>

<h2>3. Prompt Shields in practice</h2>
<p>Prompt Shields analyse two inputs separately. The <b>user prompt</b> is checked for jailbreak attempts such as role play, attempts to change system rules or encoded instructions. Each <b>document</b> (retrieved passages, emails, web content, tool results) is checked for embedded instructions aimed at the model, the typical sign of indirect prompt injection. Send retrieved content as documents rather than concatenating it into the prompt so the shield can inspect it. If an attack is detected, drop or quarantine that document, log the event, and answer from the remaining sources. Prompt Shields are one layer; still delimit untrusted content, limit tool privileges and require approval for sensitive actions.</p>

<h2>4. Content filters on deployments</h2>
<p>Every model deployment in Foundry has a content filter configuration applied to prompts and completions. Default configurations block medium and high severity harmful content; custom configurations can adjust thresholds per category, enable Prompt Shields, protected material detection and groundedness features, and attach blocklists. Changes to reduce filtering for sensitive use cases may need approval.</p>

<h2>5. Evaluation in Foundry</h2>
<table>
<tr><th>Evaluator family</th><th>Examples</th><th>Measures</th></tr>
<tr><td>AI-assisted quality</td><td>Groundedness, relevance, coherence, fluency, similarity, retrieval</td><td>Scored by a judge model, typically on a 1 to 5 scale</td></tr>
<tr><td>NLP metrics</td><td>F1 score, BLEU, ROUGE, METEOR</td><td>Overlap with reference answers</td></tr>
<tr><td>Risk and safety</td><td>Hateful and unfair, sexual, violent, self-harm, protected material, indirect attack jailbreak</td><td>Rate of unsafe responses, usually measured on adversarial data</td></tr>
<tr><td>Agent evaluators</td><td>Intent resolution, tool call accuracy, task adherence</td><td>Whether an agent understood the task and used tools correctly</td></tr>
<tr><td>Custom</td><td>Your own code or prompt-based evaluators</td><td>Domain rules, formats, citations</td></tr>
</table>

<h2>6. Evaluating groundedness of a RAG app</h2>
<ol>
<li>Build a test dataset with query, response, and the context (retrieved passages) for each row, plus ground-truth answers where available.</li>
<li>Run the groundedness evaluator, which checks whether each claim in the response is supported by the context, alongside relevance and retrieval evaluators.</li>
<li>Inspect low-scoring rows: a grounded but irrelevant answer usually means retrieval failed; an ungrounded answer means the model added unsupported claims.</li>
<li>Fix retrieval (chunking, hybrid search, semantic ranker, filters) or the prompt, and re-run.</li>
<li>Add the evaluation to CI and to continuous monitoring on sampled production traffic.</li>
</ol>
<pre>
from azure.ai.evaluation import GroundednessEvaluator, evaluate

groundedness = GroundednessEvaluator(model_config)
result = evaluate(data="rag_testset.jsonl", evaluators={"groundedness": groundedness})
</pre>

<h2>7. Red teaming and adversarial simulation</h2>
<p>Foundry provides adversarial simulators that generate attack conversations against your application, and an AI red teaming agent built on the open-source PyRIT framework that runs automated attack strategies (for example encoding, character manipulation and jailbreak styles) and reports an attack success rate by risk category. Run these before release and after every model or prompt change, and combine them with manual red teaming for domain-specific risks.</p>

<h2>8. Governance checklist</h2>
<table>
<tr><th>Area</th><th>Practice</th></tr>
<tr><td>Inventory</td><td>Record each AI app, its models, data sources, owner and risk level</td></tr>
<tr><td>Access</td><td>Entra ID and managed identities; least-privilege roles; no shared keys</td></tr>
<tr><td>Network</td><td>Private endpoints and managed network egress rules</td></tr>
<tr><td>Safety</td><td>Content filters with Prompt Shields and groundedness enabled</td></tr>
<tr><td>Quality</td><td>Evaluation gates in CI; monitoring in production</td></tr>
<tr><td>Transparency</td><td>Tell users they are using AI; show sources for answers</td></tr>
<tr><td>Incidents</td><td>Log prompts and outputs with retention rules; a process to disable features quickly</td></tr>
</table>
"""

DOCS = [
    ("azure_ai_foundry_platform_overview.pdf", "Azure AI Foundry Platform Overview", PLATFORM),
    ("building_rag_and_agents_on_foundry.pdf", "Building RAG Apps and Agents on Azure AI Foundry", RAG_AGENTS),
    ("responsible_ai_and_evaluation_on_foundry.pdf", "Responsible AI, Safety and Evaluation on Azure AI Foundry", RESPONSIBLE),
]
