// Chuyển đổi qua lại giữa object JS thường <-> google.protobuf.Struct (định dạng Dialogflow dùng
// cho queryParams.payload và queryResult.parameters). Dialogflow SDK không tự convert 2 chiều này
// cho mình nên phải tự viết, logic tương tự structjson.js trong sample chính thức của Google.

export function jsonToStructProto(json: Record<string, any>) {
  const fields: Record<string, any> = {};
  for (const key of Object.keys(json || {})) {
    fields[key] = valueToProto(json[key]);
  }
  return { fields };
}

function valueToProto(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: "NULL_VALUE" };
  }
  if (typeof value === "number") {
    return { numberValue: value };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  if (Array.isArray(value)) {
    return { listValue: { values: value.map(valueToProto) } };
  }
  if (typeof value === "object") {
    return { structValue: jsonToStructProto(value) };
  }
  throw new Error(`Không convert được giá trị sang Struct proto: ${value}`);
}

export function structProtoToJson(struct: any): Record<string, any> {
  if (!struct || !struct.fields) return {};
  const json: Record<string, any> = {};
  for (const key of Object.keys(struct.fields)) {
    json[key] = valueProtoToJson(struct.fields[key]);
  }
  return json;
}

function valueProtoToJson(value: any): any {
  if (!value) return null;
  if ("nullValue" in value) return null;
  if ("numberValue" in value) return value.numberValue;
  if ("stringValue" in value) return value.stringValue;
  if ("boolValue" in value) return value.boolValue;
  if ("listValue" in value)
    return (value.listValue.values || []).map(valueProtoToJson);
  if ("structValue" in value) return structProtoToJson(value.structValue);
  return null;
}
