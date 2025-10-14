<template>
  <div>
    <h1>Module Template Selection</h1>
    <form @submit.prevent="handleSubmit">
      <label for="templateSelect">Choose a Module Template:</label>
      <select id="templateSelect" v-model="selectedTemplate">
        <option
          v-for="template in moduleTemplates"
          :key="template.ModuleTemplate_UUID"
          :value="template.ModuleTemplate_UUID">
          {{ template.ModuleTitle }}
        </option>
      </select>
      <button type="submit" :disabled="!selectedTemplate">Select</button>
    </form>
  </div>
</template>

<script setup lang="ts">
interface ModuleTemplate {
  ModuleTemplate_UUID: string;
  ModuleTitle: string;
}
const config = useRuntimeConfig();

const ltik = ref<string | null>();
const moduleTemplates = ref<ModuleTemplate[]>([]);
const selectedTemplate = ref<string>();

const handleSubmit = async () => {
  try {
    const response = await fetch(`${config.public.httpApiUrl}/lti/deep-link`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: "Bearer " + ltik.value,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: selectedTemplate.value,
      }),
    });

    if (!response.ok) throw new Error("Failed to return deep link content");

    const { deepLinkReturnUrl, jwt } = await response.json();

    // Create and submit the form back to Canvas
    const form = document.createElement("form");
    form.method = "POST";
    form.action = deepLinkReturnUrl;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "JWT";
    input.value = jwt;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  } catch (error) {
    console.error("Deep Linking Error:", error);
    alert("An error occurred during deep link return.");
  }
};

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  ltik.value = params.get("ltik");
  if (!ltik.value) {
    alert("Missing LTI token (ltik)");
    return;
  }

  try {
    const response = await fetch(
      `${config.public.httpApiUrl}/lti/module-templates`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: "Bearer " + ltik.value,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch module templates");
    }

    const templates = (await response.json()) as ModuleTemplate[];
    moduleTemplates.value = templates;

    if (templates.length > 0) {
      selectedTemplate.value = templates[0].ModuleTemplate_UUID;
    }
  } catch (error) {
    console.error("Error loading module templates:", error);
    alert("Failed to load module templates.");
  }
});
</script>

<style scoped>
h1 {
  margin-bottom: 24px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

select {
  display: block;
  margin-bottom: 24px;
  padding: 8px;
  width: 100%;
  max-width: 320px;
  font-size: 1rem;
}

button {
  padding: 10px 24px;
  font-size: 1rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
