import { describe, expect, it } from "vitest";

import { bpmnToContract } from "./bpmn-to-contract";

const SIMPLE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://fluence.mx/bpmn">
  <bpmn:process id="Process_1" name="Proceso de prueba" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="Operaciones">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Inicio" />
    <bpmn:task id="Task_1" name="Revisar solicitud" />
    <bpmn:endEvent id="End_1" name="Fin" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
</bpmn:definitions>`;

describe("bpmnToContract", () => {
    it("omite campos opcionales vacios en lugar de serializarlos como null", async () => {
        const contract = await bpmnToContract(SIMPLE_BPMN);

        expect(contract.process).not.toHaveProperty("description");
        expect(contract).not.toHaveProperty("dataStores");
        expect(contract.nodes).toHaveLength(3);
        for (const node of contract.nodes) {
            expect(node).not.toHaveProperty("description");
            expect(node).not.toHaveProperty("reads");
            expect(node).not.toHaveProperty("writes");
            expect(node).not.toHaveProperty("risks");
            expect(node).not.toHaveProperty("controls");
            expect(node).not.toHaveProperty("opportunities");
        }
        for (const edge of contract.edges) expect(edge).not.toHaveProperty("label");
        expect(JSON.stringify(contract)).not.toContain(":null");
    });
});
