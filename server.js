const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const systemData = {
  total_users: 284,
  completed: 61,
  stuck_state_id: 52,
  stuck_ssn: 28,
  stuck_birth: 20,
  transport_needed: 37
};

const clients = [
  {
    id: "CL-1001",
    name: "Maria Lopez",
    city: "Paterson",
    missing_documents: ["birth_certificate", "state_id"],
    transportation_needed: true,
    status: "pending",
    assigned_worker: null,
    worker_status: null
  },
  {
    id: "CL-1002",
    name: "James Carter",
    city: "Passaic",
    missing_documents: ["ssn"],
    transportation_needed: false,
    status: "pending",
    assigned_worker: null,
    worker_status: null
  },
  {
    id: "CL-1003",
    name: "Aisha Brown",
    city: "Clifton",
    missing_documents: ["state_id"],
    transportation_needed: true,
    status: "pending",
    assigned_worker: null,
    worker_status: null
  },
  {
    id: "CL-1004",
    name: "Luis Rivera",
    city: "Wayne",
    missing_documents: ["birth_certificate", "ssn", "state_id"],
    transportation_needed: true,
    status: "pending",
    assigned_worker: null,
    worker_status: null
  },
  {
    id: "CL-1005",
    name: "Nina Patel",
    city: "Totowa",
    missing_documents: ["birth_certificate"],
    transportation_needed: false,
    status: "pending",
    assigned_worker: null,
    worker_status: null
  },
  {
    id: "CL-1006",
    name: "Robert Green",
    city: "Paterson",
    missing_documents: ["ssn", "state_id"],
    transportation_needed: false,
    status: "assigned",
    assigned_worker: "WK-03",
    worker_status: "active"
  }
];

const workers = [
  { id: "WK-01", name: "Sarah Ahmed", active_cases: 4 },
  { id: "WK-02", name: "Daniel Kim", active_cases: 6 },
  { id: "WK-03", name: "Priya Shah", active_cases: 3 },
  { id: "WK-04", name: "Marcus Hill", active_cases: 7 }
];

const notifications = [
  {
    id: "NT-01",
    message: "Priya Shah assigned to Robert Green",
    worker_id: "WK-03",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString()
  },
  {
    id: "NT-02",
    message: "County dashboard synced with latest request queue",
    worker_id: "system",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString()
  }
];

function getRecommendedWorker() {
  return workers.reduce((lowest, worker) => (
    worker.active_cases < lowest.active_cases ? worker : lowest
  ), workers[0]);
}

function createInsightResponse(questionRaw) {
  const question = String(questionRaw || "").toLowerCase();

  if (question.includes("stuck") || question.includes("problem")) {
    return "Most users are stuck at the State ID step. This happens because it needs in-person appointments. You should increase MVC availability and transportation support.";
  }

  if (question.includes("transport")) {
    return `Transportation is affecting ${systemData.transport_needed}% of users. This slows down office visits and document pickup. You should expand ride support and travel vouchers.`;
  }

  if (question.includes("how many") || question.includes("load") || question.includes("workload")) {
    const recommended = getRecommendedWorker();
    return `${systemData.total_users} users are active and ${systemData.completed} are complete. The lightest worker is ${recommended.name} with ${recommended.active_cases} active cases. You should route new clients there first.`;
  }

  if (question.includes("improve") || question.includes("solution")) {
    return "State ID delays are the biggest problem. They happen because of appointment bottlenecks and travel needs. You should add MVC coordination and faster transportation support.";
  }

  return "Most delays are happening at the State ID step. This is driven by appointments and transportation barriers. You should focus on faster scheduling and travel support.";
}

app.get("/api/clients", (_req, res) => {
  res.json({
    clients,
    recommended_worker_id: getRecommendedWorker().id
  });
});

app.get("/api/workers", (_req, res) => {
  res.json({
    workers,
    recommended_worker_id: getRecommendedWorker().id
  });
});

app.get("/api/notifications", (_req, res) => {
  res.json({
    notifications: notifications.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  });
});

app.post("/api/assign", (req, res) => {
  const { client_id: clientId, worker_id: workerId } = req.body || {};
  const client = clients.find((item) => item.id === clientId);
  const worker = workers.find((item) => item.id === workerId);

  if (!client || !worker) {
    res.status(400).json({ error: "Client or worker not found." });
    return;
  }

  if (client.status === "assigned" && client.assigned_worker === workerId) {
    res.json({
      success: true,
      client,
      worker,
      recommended_worker_id: getRecommendedWorker().id
    });
    return;
  }

  if (client.assigned_worker && client.assigned_worker !== workerId) {
    const previousWorker = workers.find((item) => item.id === client.assigned_worker);
    if (previousWorker && previousWorker.active_cases > 0) {
      previousWorker.active_cases -= 1;
    }
  }

  client.assigned_worker = workerId;
  client.status = "assigned";
  client.worker_status = "pending_approval";
  worker.active_cases += 1;

  notifications.unshift({
    id: `NT-${Date.now()}`,
    message: `${worker.name} assigned to ${client.name}`,
    worker_id: worker.id,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    client,
    worker,
    recommended_worker_id: getRecommendedWorker().id
  });
});

app.post("/api/case-status", (req, res) => {
  const { client_id: clientId, worker_id: workerId, action } = req.body || {};
  const client = clients.find((item) => item.id === clientId);
  const worker = workers.find((item) => item.id === workerId);

  if (!client || !worker || client.assigned_worker !== workerId) {
    res.status(400).json({ error: "Client or worker not found." });
    return;
  }

  if (action === "accept") {
    client.worker_status = "active";
    notifications.unshift({
      id: `NT-${Date.now()}`,
      message: `${worker.name} accepted ${client.name}`,
      worker_id: worker.id,
      timestamp: new Date().toISOString()
    });
  } else if (action === "reject") {
    client.worker_status = "rejected";
    client.status = "pending";
    client.assigned_worker = null;
    if (worker.active_cases > 0) {
      worker.active_cases -= 1;
    }
    notifications.unshift({
      id: `NT-${Date.now()}`,
      message: `${worker.name} rejected ${client.name}`,
      worker_id: worker.id,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(400).json({ error: "Invalid action." });
    return;
  }

  res.json({
    success: true,
    client,
    worker,
    recommended_worker_id: getRecommendedWorker().id
  });
});

app.post("/api/admin-chat", (req, res) => {
  const { question = "" } = req.body || {};
  res.json({
    response: createInsightResponse(question)
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Passaic County Housing Coordination System running at http://localhost:${PORT}`);
});
