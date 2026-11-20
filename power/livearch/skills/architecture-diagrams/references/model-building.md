# Building model.json from IaC

Operational procedure for the agent. The design rationale lives in the LiveArch repo
(`.kiro/steering/architecture-model.md`, `.kiro/steering/iac-sources.md`). This file must stay consistent with them.

## Detection
| Marker | Adapter | Read |
|--------|---------|------|
| `*.tf` | terraform | every `.tf` file (not `.tfvars`, not `.terraform/`) |
| `cdk.json` | cdk | `cdk.out/*.template.json` only |
| a `.json`/`.yaml` file with `AWSTemplateFormatVersion` or top-level `Resources` | cloudformation | the template |

Every Terraform root module and every CloudFormation/CDK stack becomes a `module` group, but **only when the repo has
more than one**.

## Step 1: list raw resources
For each resource, collect: **address**, **type**, **attributes** (literal values only), **references** to other
resources, **file** and **line**.
- Terraform address: `aws_sqs_queue.orders`, `module.net.aws_subnet.public`, `aws_subnet.az[0]`.
  `data` blocks, `variable`, `output`, `locals` and `provider` blocks are **not** resources.
- CloudFormation/CDK address: `<StackName>.<LogicalId>`. `Ref`, `Fn::GetAtt`, `Fn::Sub` (`${X}`) and `Fn::ImportValue` are references.
- Local modules are expanded. A remote module becomes an empty `module` group, plus a `REMOTE_MODULE` warning.
- `count`/`for_each` with a literal of 3 or less gives one resource per instance (`[0]`, `["key"]`). Otherwise it gives one
  resource with `properties.instances = N`, or with `properties.unresolved = "count"` when N is unknown.

## Step 2: classify with the catalog
Look the type up in `resource-catalog.json`. An **exact match** in `resources`, `groups` or `hidden` (by `iacType` or
`aliases`) always wins over `hiddenPrefixes`.
- `resources` → **node**: `kind` and short label from the catalog; `properties` = only the keys in its allowlist that have a literal value.
- `groups` → **group**: `kind` = `groupKind`.
- `hidden` or a matching `hiddenPrefixes` entry → no node. Keep it in memory for reference collapsing and edge inference.
- Not found → node with `kind: "external"`, `properties.unmapped = true`, plus an `UNMAPPED_TYPE` warning (`ref` = address).
  Never invent a mapping.

## Step 3: IDs and labels
- `id` = address. `diagramId` = `"la_" + address`, with every char outside `[A-Za-z0-9_]` replaced by `_`.
- Label = the resource **name** part of the address (`orders` for `aws_sqs_queue.orders`), or the last segment of the
  CDK construct path. Truncate to 40 chars with `…`. Never use tag values or variable values.

## Step 4: membership
- A node or a subnet belongs to the **most specific** group it references, directly or through hidden resources,
  via the catalog's `membership` attribute and its synonyms: `subnet_id` / `subnets` / `subnet_ids` point to a subnet,
  `vpc_id` points to a network. A subnet wins over a network; between two subnets, the first in source order wins.
- Follow hidden resources: `aws_db_instance → aws_db_subnet_group → aws_subnet` makes the subnet the DB's group.
- A subnet's `parent` is its VPC. With nothing to belong to: `group: null`.

## Step 5: edges
Apply the rules in this order of priority. Keep **one edge per (from, to)** pair: the strongest kind wins
(`network-flow` > `trigger` > `data-access` > `depends-on`).
1. `lb-listener`: listener → target group → the service whose `load_balancer.target_group_arn` points to it gives
   `LB --network-flow--> service`. Label `"<PROTOCOL> <port>"` from the listener.
2. `sg-ingress`: an ingress rule in SG *B* that allows SG *A* gives `network-flow` from each node using *A* to each
   node using *B*. Label `"TCP <port>"`.
3. `event-source` / `subscription`: `source --trigger--> function/endpoint`.
4. A compute, container or function node that references (directly or via env vars / task definitions / hidden resources) a
   queue, topic, stream, database, cache, object-storage or secret gives `--data-access-->`, with label `null`.
5. Any other reference between two visible nodes gives `depends-on`.
- Edge `id` = `<from>--<kind>--><to>`, `diagramId` = `"la_e_" + sanitize(id)`. There are no edges to groups and no self-edges.

## Step 6: assemble
Fill in `generator` (`livearch`, the skill version, the catalog's `catalogVersion`), `source.adapters`,
`source.commit` (`git rev-parse --short HEAD`, or `null`) and `source.files` (path + sha256 of every IaC file read).
Sort everything by `id`. Add no timestamps.

## Worked example
`examples/aws-three-tier` in the LiveArch repo: four `.tf` files give 3 groups, 6 nodes and 6 edges. Note how:
- `DB_HOST` in the task definition gives `api → orders_db`, which becomes `network-flow` (SG rule) rather than `data-access`;
- the S3 public access block is hidden by prefix;
- the IAM roles never appear.
