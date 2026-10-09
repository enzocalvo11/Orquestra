import assert from "node:assert/strict";
import test from "node:test";
import { assignWorkItem, AzureDevOpsError, getAzureSource, replaceTagType, updateResponsibleTag } from "./azure-devops.ts";
import { plannedItems } from "./planning.ts";

test("troca somente a tag de responsável e preserva as demais", () => {
  assert.equal(
    updateResponsibleTag("hackathon; responsavel:dev1; equipe:backend", "ana"),
    "hackathon; equipe:backend; responsavel:ana",
  );
});

test("não duplica tags existentes, ignorando diferenças de caixa", () => {
  assert.equal(
    updateResponsibleTag("Hackathon; hackathon; RESPONSAVEL:ana", "ana"),
    "Hackathon; responsavel:ana",
  );
});

test("mantém uma tag por tipo responsável, prazo e demo", () => {
  assert.equal(
    updateResponsibleTag(
      "demo-101; demo-102; prazo-2026-10-18; prazo:2026-10-19; responsavel:ana; responsavel:bruno; equipe:backend",
      "elisa",
    ),
    "demo-101; prazo-2026-10-18; equipe:backend; responsavel:elisa",
  );
  assert.equal(
    replaceTagType("demo-101; prazo-2026-10-18; equipe:backend", "prazo", "prazo:2026-11-01"),
    "demo-101; equipe:backend; prazo:2026-11-01",
  );
  assert.equal(
    replaceTagType("demo-101; prazo-2026-10-18; equipe:backend", "demo", "demo:release-2"),
    "prazo-2026-10-18; equipe:backend; demo:release-2",
  );
});

test("consulta, atualiza tags e faz GET de confirmação sem alterar AssignedTo", async () => {
  const requests = [];
  let currentTags = "hackathon; responsavel:dev1; equipe:backend";
  const fakeFetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (init?.method === "PATCH") {
      const [operation] = JSON.parse(init.body);
      currentTags = operation.op === "replace"
        ? operation.value
        : `${currentTags}; ${operation.value}`;
      return new Response(null, { status: 200 });
    }
    return Response.json({ id: 46, fields: {
      "System.Title": "Interface do calendário",
      "System.Tags": currentTags,
    } });
  };

  const workItem = await assignWorkItem({ organization: "org", project: "project", pat: "secret" }, 46, "ana", fakeFetch);
  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /\/workitems\/46\?api-version=7\.1$/);
  assert.equal(requests[1].init.method, "PATCH");
  const headers = new Headers(requests[1].init.headers);
  assert.equal(headers.get("content-type"), "application/json-patch+json");
  assert.equal(headers.get("authorization"), `Basic ${btoa(":secret")}`);
  assert.deepEqual(JSON.parse(requests[1].init.body), [
    { op: "replace", path: "/fields/System.Tags", value: "hackathon; equipe:backend; responsavel:ana" },
  ]);
  assert.deepEqual(workItem, {
    id: 46,
    title: "Interface do calendário",
    tags: ["hackathon", "equipe:backend", "responsavel:ana"],
  });
});

test("falha se o GET de confirmacao ainda contiver a tag anterior", async () => {
  let getCount = 0;
  const fakeFetch = async (_input, init) => {
    if (init?.method === "PATCH") return new Response(null, { status: 200 });
    getCount++;
    const tags = getCount === 1
      ? "responsavel:dev1; equipe:backend"
      : "responsavel:ana; responsavel:dev1; equipe:backend";
    return Response.json({ id: 46, fields: { "System.Tags": tags } });
  };

  await assert.rejects(
    assignWorkItem({ organization: "org", project: "project", pat: "secret" }, 46, "ana", fakeFetch),
    error => error instanceof AzureDevOpsError && error.status === 502,
  );
});

test("usa add somente quando o Work Item ainda nao tem tags", async () => {
  const requests = [];
  let currentTags = "";
  const fakeFetch = async (_input, init) => {
    requests.push(init);
    if (init?.method === "PATCH") {
      const [operation] = JSON.parse(init.body);
      currentTags = operation.value;
      return new Response(null, { status: 200 });
    }
    return Response.json({ id: 46, fields: { "System.Tags": currentTags } });
  };

  const item = await assignWorkItem({ organization: "org", project: "project", pat: "secret" }, 46, "ana", fakeFetch);
  assert.equal(JSON.parse(requests[1].body)[0].op, "add");
  assert.deepEqual(item.tags, ["responsavel:ana"]);
});

test("converte falha HTTP de leitura em erro sem expor resposta", async () => {
  const fakeFetch = async () => new Response("sensitive response", { status: 404 });
  await assert.rejects(
    assignWorkItem({ organization: "org", project: "project", pat: "secret" }, 999, "ana", fakeFetch),
    error => error instanceof AzureDevOpsError && error.status === 404 && !error.message.includes("sensitive"),
  );
});

test("carrega Work Items e Projects do Azure DevOps como fonte atual", async () => {
  const requests = [];
  const fakeFetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (String(input).includes("/wiql?")) {
      return Response.json({ workItems: [{ id: 46 }] });
    }
    return Response.json({ value: [{
      id: 46,
      fields: {
        "System.Title": "Interface do calendário",
        "System.WorkItemType": "Task",
        "System.State": "Active",
        "System.AreaPath": "Orquestra2\\Portal de Agendamento",
        "System.TeamProject": "Orquestra2",
        "System.IterationPath": "Orquestra2\\S1",
        "System.Tags": "demo-101; habilidade-frontend; prazo-2026-10-18; responsavel:ana",
        "Microsoft.VSTS.Scheduling.DueDate": "2026-10-18T00:00:00Z",
        "Microsoft.VSTS.Scheduling.RemainingWork": 12,
        "Microsoft.VSTS.Common.Priority": 1,
      },
    }] });
  };

  const source = await getAzureSource({ organization: "ImportAtlas", project: "Orquestra2", pat: "secret" }, fakeFetch);
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[0].init.body).query.includes("@project"), true);
  assert.match(requests[1].url, /ids=46/);
  assert.equal(source.workItems[0].id, "AZURE-46");
  assert.equal(source.workItems[0].title, "Interface do calendário");
  assert.equal(source.workItems[0].personId, "ana");
  assert.equal(source.workItems[0].skill, "frontend");
  assert.equal(source.workItems[0].hours, 12);
  assert.equal(source.projects[0].name, "Portal de Agendamento");
  assert.equal(source.workItems.length, 1);
});

test("usa a tag do Azure mesmo se D1 guardar outro responsavel", () => {
  const azureTask = {
    id: "AZURE-46", externalId: 46, projectId: "portal", feature: "Feature", pbi: "PBI",
    title: "Task", type: "Task", status: "Pendente", personId: "ana", week: 0,
    dueWeek: 0, hours: 8, skill: "frontend", priority: "MÃ©dia", description: "",
  };
  const savedChanges = [{ taskId: "AZURE-46", personId: "bruno", weekIndex: 1 }];

  const persistedView = plannedItems(savedChanges, [azureTask], savedChanges);
  assert.equal(persistedView[0].plannedPersonId, "ana");
  assert.equal(persistedView[0].plannedWeek, 1);

  const draft = [{ taskId: "AZURE-46", personId: "carla", weekIndex: 2 }];
  const draftView = plannedItems(draft, [azureTask], savedChanges);
  assert.equal(draftView[0].plannedPersonId, "carla");
  assert.equal(draftView[0].plannedWeek, 2);
});
