"""Foundation documents: AWS Cloud."""

NOTE = '<p class="note">Sample foundation document written for testing a domain-expert RAG. AWS services, limits and model availability change often; confirm details in the official AWS documentation.</p>'

SECURITY = """
<h1>AWS Security and Identity</h1>
<p class="meta">AWS foundations, volume 1 · Version 2026.1</p>
""" + NOTE + """
<h2>1. The shared responsibility model</h2>
<p>AWS is responsible for security <b>of</b> the cloud: data centres, hardware, the hypervisor and the managed parts of services. The customer is responsible for security <b>in</b> the cloud: identities and permissions, network configuration, operating systems on EC2, application code, and data classification and encryption. The more managed the service, the more AWS takes on; with Lambda you do not patch servers, but you still own the function's permissions and code.</p>

<h2>2. IAM building blocks</h2>
<table>
<tr><th>Concept</th><th>What it is</th><th>Good practice</th></tr>
<tr><td>Root user</td><td>The account owner identity with unrestricted access</td><td>Enable MFA, remove access keys, use only for the few tasks that need it</td></tr>
<tr><td>IAM user</td><td>A long-lived identity with credentials</td><td>Avoid for people; use federation through IAM Identity Center</td></tr>
<tr><td>IAM role</td><td>An identity assumed temporarily by a service, user or workload</td><td>Default choice for workloads (EC2 instance profiles, Lambda execution roles, EKS pod identities)</td></tr>
<tr><td>Identity-based policy</td><td>Permissions attached to a user, group or role</td><td>Grant least privilege; scope resources and conditions</td></tr>
<tr><td>Resource-based policy</td><td>Permissions attached to a resource, such as an S3 bucket policy or KMS key policy</td><td>Use for cross-account access; always name principals explicitly</td></tr>
<tr><td>Service control policy (SCP)</td><td>An AWS Organizations guardrail on the maximum permissions in accounts</td><td>Deny disabling CloudTrail, leaving the organisation, or using unapproved regions</td></tr>
<tr><td>Permissions boundary</td><td>A cap on what an identity's policies can grant</td><td>Let teams create roles safely without escalating privilege</td></tr>
</table>

<h2>3. How IAM evaluates a request</h2>
<ol>
<li>Everything starts as an implicit deny.</li>
<li>An explicit <b>Deny</b> in any applicable policy always wins.</li>
<li>SCPs, permissions boundaries and session policies must all allow the action.</li>
<li>An identity-based or resource-based policy must explicitly <b>Allow</b> it.</li>
</ol>
<p>Conditions such as <code>aws:SourceIp</code>, <code>aws:PrincipalOrgID</code>, <code>aws:SecureTransport</code> and resource tags make policies much tighter. Avoid wildcards like <code>"Action": "*"</code> and <code>"Resource": "*"</code>; IAM Access Analyzer can generate least-privilege policies from CloudTrail activity and find resources shared outside the account.</p>
<pre>
{"Effect": "Allow",
 "Action": ["s3:GetObject"],
 "Resource": "arn:aws:s3:::invoices-prod/*",
 "Condition": {"Bool": {"aws:SecureTransport": "true"}}}
</pre>

<h2>4. Credentials</h2>
<p>Prefer temporary credentials from roles and IAM Identity Center over long-lived access keys. If access keys are unavoidable, rotate them, never commit them to code, and alert on their use from unexpected locations. Store application secrets in AWS Secrets Manager, which supports automatic rotation for databases, or in Systems Manager Parameter Store for simpler configuration values.</p>

<h2>5. Encryption with KMS</h2>
<p>AWS Key Management Service (KMS) manages encryption keys. Most services encrypt data with a data key that KMS generates and protects with a KMS key (envelope encryption). Customer managed keys let you control the key policy, rotation and who can decrypt; AWS managed keys are simpler but less controllable. Key policies are resource-based policies, so a principal needs permission both in IAM and in the key policy. Automatic key rotation can be enabled for customer managed symmetric keys.</p>

<h2>6. Logging and detection</h2>
<table>
<tr><th>Service</th><th>Purpose</th></tr>
<tr><td>AWS CloudTrail</td><td>Records API calls across the account; create an organisation trail to a locked-down S3 bucket</td></tr>
<tr><td>Amazon CloudWatch</td><td>Metrics, logs, alarms and dashboards</td></tr>
<tr><td>Amazon GuardDuty</td><td>Threat detection from CloudTrail, VPC Flow Logs, DNS logs and more</td></tr>
<tr><td>AWS Security Hub</td><td>Aggregates findings and checks against security standards</td></tr>
<tr><td>AWS Config</td><td>Records resource configuration and evaluates compliance rules</td></tr>
<tr><td>IAM Access Analyzer</td><td>Finds external access and unused permissions</td></tr>
</table>

<h2>7. Multi-account strategy</h2>
<p>Use AWS Organizations with separate accounts for production, non-production, security tooling and log archive. Accounts are the strongest isolation boundary in AWS. AWS Control Tower sets up a landing zone with guardrails, centralised logging and account vending. Apply SCPs at organisational units rather than individual accounts.</p>
"""

INFRA = """
<h1>AWS Networking, Compute and Storage</h1>
<p class="meta">AWS foundations, volume 2 · Version 2026.1</p>
""" + NOTE + """
<h2>1. VPC fundamentals</h2>
<p>A Virtual Private Cloud (VPC) is an isolated network in one region, spanning its Availability Zones. Subnets live in a single Availability Zone. A <b>public subnet</b> has a route to an internet gateway; a <b>private subnet</b> does not, and reaches the internet (if at all) through a NAT gateway in a public subnet. Place load balancers in public subnets and application servers and databases in private subnets across at least two Availability Zones.</p>

<h2>2. Security groups and network ACLs</h2>
<table>
<tr><th></th><th>Security group</th><th>Network ACL</th></tr>
<tr><td>Applies to</td><td>Elastic network interfaces (instances, load balancers, endpoints)</td><td>Whole subnets</td></tr>
<tr><td>State</td><td>Stateful: return traffic is allowed automatically</td><td>Stateless: return traffic needs its own rule, including ephemeral ports</td></tr>
<tr><td>Rules</td><td>Allow rules only</td><td>Allow and deny rules</td></tr>
<tr><td>Evaluation</td><td>All rules evaluated together</td><td>Rules evaluated in number order; first match wins</td></tr>
<tr><td>Typical use</td><td>Primary, fine-grained control; reference other security groups by ID</td><td>Coarse subnet-level blocks, such as denying a known bad range</td></tr>
</table>

<h2>3. Private connectivity</h2>
<p>VPC endpoints let resources reach AWS services without going over the internet. <b>Gateway endpoints</b> exist for S3 and DynamoDB and are added to route tables at no hourly charge. <b>Interface endpoints</b> (AWS PrivateLink) place elastic network interfaces in your subnets for many other services and for services offered by other accounts. Endpoint policies can restrict which buckets or actions are reachable. For hybrid connectivity use Site-to-Site VPN or AWS Direct Connect; for many VPCs use AWS Transit Gateway.</p>

<h2>4. Compute choices</h2>
<table>
<tr><th>Service</th><th>Best for</th><th>Notes</th></tr>
<tr><td>Amazon EC2</td><td>Full control, GPUs, long-running services</td><td>Choose instance families by workload: general, compute, memory, accelerated</td></tr>
<tr><td>AWS Lambda</td><td>Event-driven functions and APIs</td><td>Maximum run time 15 minutes; memory configurable from 128 MB to 10,240 MB; ephemeral storage up to 10 GB</td></tr>
<tr><td>Amazon ECS / AWS Fargate</td><td>Containers without managing a cluster (Fargate) or with EC2 capacity</td><td>Simpler than Kubernetes for most teams</td></tr>
<tr><td>Amazon EKS</td><td>Managed Kubernetes</td><td>When you need the Kubernetes ecosystem</td></tr>
</table>
<h3>4.1 EC2 purchasing options</h3>
<table>
<tr><th>Option</th><th>When to use</th></tr>
<tr><td>On-Demand</td><td>Unpredictable or short workloads</td></tr>
<tr><td>Savings Plans / Reserved Instances</td><td>Steady usage committed for 1 or 3 years, at a large discount</td></tr>
<tr><td>Spot Instances</td><td>Fault-tolerant, interruptible work such as batch and CI; up to about 90% cheaper; AWS gives a two-minute interruption notice</td></tr>
<tr><td>Dedicated Hosts</td><td>Licensing or compliance needs for physical isolation</td></tr>
</table>

<h2>5. Load balancing and scaling</h2>
<p>The Application Load Balancer works at layer 7 (HTTP/HTTPS) with path and host routing, and integrates with AWS WAF. The Network Load Balancer works at layer 4 (TCP/UDP/TLS) for very high throughput and static IPs. The Gateway Load Balancer inserts third-party appliances such as firewalls. EC2 Auto Scaling groups replace unhealthy instances and scale on metrics such as CPU or request count per target.</p>

<h2>6. Amazon S3</h2>
<p>S3 is designed for 99.999999999% (eleven nines) durability. New objects are encrypted at rest by default with SSE-S3; use SSE-KMS when you need control over who can decrypt and an audit trail of key use.</p>
<table>
<tr><th>Storage class</th><th>Use</th></tr>
<tr><td>S3 Standard</td><td>Frequently accessed data</td></tr>
<tr><td>S3 Intelligent-Tiering</td><td>Unknown or changing access patterns; moves objects between tiers automatically</td></tr>
<tr><td>S3 Standard-IA / One Zone-IA</td><td>Infrequent access; One Zone-IA keeps data in a single Availability Zone</td></tr>
<tr><td>S3 Glacier Instant Retrieval</td><td>Archive data that still needs millisecond access</td></tr>
<tr><td>S3 Glacier Flexible Retrieval / Deep Archive</td><td>Long-term archives retrieved in minutes to hours</td></tr>
</table>
<h3>6.1 Securing a bucket with customer data</h3>
<ol>
<li>Keep S3 Block Public Access on at account and bucket level.</li>
<li>Disable ACLs (Object Ownership: bucket owner enforced) and use bucket policies.</li>
<li>Require TLS with an <code>aws:SecureTransport</code> deny statement.</li>
<li>Encrypt with SSE-KMS using a customer managed key, and restrict the key policy.</li>
<li>Enable versioning, and Object Lock where records must not be altered.</li>
<li>Restrict access to specific roles and, where possible, to your VPC endpoint.</li>
<li>Turn on CloudTrail data events or server access logging, and Amazon Macie to find sensitive data.</li>
<li>Use lifecycle rules to delete data at the end of its retention period.</li>
</ol>

<h2>7. Databases</h2>
<table>
<tr><th>Service</th><th>Type</th><th>Notes</th></tr>
<tr><td>Amazon RDS</td><td>Managed relational (PostgreSQL, MySQL, others)</td><td>Multi-AZ deployments for automatic failover; read replicas for scale</td></tr>
<tr><td>Amazon Aurora</td><td>Cloud-native MySQL/PostgreSQL compatible</td><td>Storage replicated across three Availability Zones; Aurora Serverless for variable load</td></tr>
<tr><td>Amazon DynamoDB</td><td>Key-value and document NoSQL</td><td>Single-digit millisecond latency; on-demand or provisioned capacity; global tables</td></tr>
<tr><td>Amazon ElastiCache</td><td>In-memory cache (Redis-compatible, Memcached)</td><td>Session stores and hot data</td></tr>
<tr><td>Amazon OpenSearch Service</td><td>Search and analytics, including vector search</td><td>Serverless option available</td></tr>
</table>
"""

WELL_ARCHITECTED = """
<h1>Well-Architected Design and Generative AI on AWS</h1>
<p class="meta">AWS foundations, volume 3 · Version 2026.1</p>
""" + NOTE + """
<h2>1. The six pillars of the Well-Architected Framework</h2>
<table>
<tr><th>Pillar</th><th>Focus</th><th>Example design principles</th></tr>
<tr><td>Operational excellence</td><td>Running and improving workloads</td><td>Infrastructure as code, small reversible changes, learn from failures</td></tr>
<tr><td>Security</td><td>Protecting data, systems and assets</td><td>Strong identity foundation, traceability, security at all layers, encrypt data</td></tr>
<tr><td>Reliability</td><td>Recovering from failure and meeting demand</td><td>Automatic recovery, test recovery procedures, scale horizontally</td></tr>
<tr><td>Performance efficiency</td><td>Using resources efficiently</td><td>Use managed and serverless services, experiment, go global in minutes</td></tr>
<tr><td>Cost optimisation</td><td>Avoiding unnecessary cost</td><td>Consumption model, measure efficiency, stop spending on undifferentiated work</td></tr>
<tr><td>Sustainability</td><td>Minimising environmental impact</td><td>Maximise utilisation, use efficient hardware and managed services</td></tr>
</table>
<p>The AWS Well-Architected Tool lets teams review workloads against these pillars and track improvement plans. Specialised lenses exist, including one for generative AI.</p>

<h2>2. Disaster recovery strategies</h2>
<table>
<tr><th>Strategy</th><th>RPO / RTO</th><th>Cost</th></tr>
<tr><td>Backup and restore</td><td>Hours</td><td>Lowest</td></tr>
<tr><td>Pilot light</td><td>Minutes to tens of minutes; core data replicated, compute off</td><td>Low</td></tr>
<tr><td>Warm standby</td><td>Minutes; a scaled-down copy runs in the second region</td><td>Medium</td></tr>
<tr><td>Multi-site active/active</td><td>Near zero; both regions serve traffic</td><td>Highest</td></tr>
</table>
<p>Multi-AZ designs protect against data centre failures and are the baseline for production. Multi-region designs protect against regional events and are justified only when the business impact requires them.</p>

<h2>3. Amazon Bedrock</h2>
<p>Amazon Bedrock is a fully managed service for building generative AI applications with foundation models from Amazon and other providers through one API, without managing infrastructure. Prompts and outputs are not used to train the base models, and data stays in the region you use.</p>
<table>
<tr><th>Capability</th><th>What it does</th></tr>
<tr><td>Model access</td><td>Invoke text, chat, embedding and image models through the Converse and InvokeModel APIs</td></tr>
<tr><td>Knowledge Bases</td><td>Managed RAG: connect data sources such as S3, chunk and embed documents, store vectors, and retrieve with citations</td></tr>
<tr><td>Agents</td><td>Orchestrate multi-step tasks with action groups that call Lambda functions or APIs described with OpenAPI</td></tr>
<tr><td>Guardrails</td><td>Content filters, denied topics, word filters, sensitive information (PII) redaction and contextual grounding checks, applied to inputs and outputs</td></tr>
<tr><td>Model customisation</td><td>Fine-tuning and continued pre-training on your data, producing private model copies</td></tr>
<tr><td>Provisioned Throughput</td><td>Reserved capacity for predictable, high-volume use or custom models</td></tr>
<tr><td>Evaluation</td><td>Automatic and human evaluation of models and RAG pipelines</td></tr>
</table>

<h2>4. Building a RAG application on Bedrock</h2>
<ol>
<li>Put documents in an S3 bucket with encryption and least-privilege access.</li>
<li>Create a Knowledge Base, choose an embedding model and a vector store (for example OpenSearch Serverless or Aurora PostgreSQL with pgvector), and choose a chunking strategy.</li>
<li>Sync the data source; re-sync when documents change.</li>
<li>Query with the Retrieve API (passages only) or RetrieveAndGenerate (passages plus a generated answer with citations).</li>
<li>Attach a Guardrail with contextual grounding checks so ungrounded answers are blocked.</li>
<li>Use metadata filters to limit retrieval by tenant, team or document type.</li>
<li>Log invocations with model invocation logging and CloudWatch, and evaluate with a golden question set.</li>
</ol>
<pre>
import boto3
client = boto3.client("bedrock-agent-runtime")
resp = client.retrieve_and_generate(
    input={"text": "What is our refund window?"},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {"knowledgeBaseId": KB_ID, "modelArn": MODEL_ARN}})
print(resp["output"]["text"])
</pre>

<h2>5. Amazon SageMaker AI</h2>
<p>SageMaker AI covers the full machine-learning lifecycle for teams that train or host their own models: managed notebooks and studios, training jobs on CPU and GPU clusters, hyperparameter tuning, a model registry, real-time, serverless, asynchronous and batch inference endpoints, and SageMaker JumpStart for deploying open models with a few clicks. Choose Bedrock when a managed foundation model fits; choose SageMaker or EC2 when you need full control of the model and serving stack.</p>

<h2>6. Security for generative AI on AWS</h2>
<ul>
<li>Use VPC interface endpoints for Bedrock so traffic stays on the AWS network.</li>
<li>Restrict model access with IAM policies on specific model ARNs, and use SCPs to block unapproved models or regions.</li>
<li>Encrypt Knowledge Base data and agent sessions with customer managed KMS keys.</li>
<li>Give agent action-group Lambda functions least-privilege roles, and require confirmation for sensitive actions.</li>
<li>Enable model invocation logging to a protected bucket for audit.</li>
<li>Apply Guardrails, but keep deterministic checks for high-impact actions.</li>
</ul>

<h2>7. Cost levers</h2>
<table>
<tr><th>Lever</th><th>Effect</th></tr>
<tr><td>Right-size and schedule</td><td>Turn off non-production resources outside working hours</td></tr>
<tr><td>Savings Plans and Spot</td><td>Large discounts for steady or interruptible compute</td></tr>
<tr><td>Storage lifecycle</td><td>Move cold data to cheaper S3 classes automatically</td></tr>
<tr><td>Model choice</td><td>Use the smallest model that meets quality targets; cache prompts; batch offline jobs</td></tr>
<tr><td>Visibility</td><td>Cost allocation tags, AWS Budgets alerts and Cost Explorer</td></tr>
</table>
"""

DOCS = [
    ("aws_security_and_identity.pdf", "AWS Security and Identity", SECURITY),
    ("aws_networking_compute_storage.pdf", "AWS Networking, Compute and Storage", INFRA),
    ("aws_well_architected_and_bedrock.pdf", "Well-Architected Design and Generative AI on AWS", WELL_ARCHITECTED),
]
