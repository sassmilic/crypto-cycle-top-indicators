import axios from "axios";
import { cryptoApis } from "../config/apis.js";

const testCryptoPriceApis = async () => {
  console.log("Starting API tests...\n");

  for (const api of cryptoApis) {
    try {
      console.log(`Testing ${api.name} API...`);
      console.log(`URL: ${api.url}`);

      const startTime = Date.now();
      const response = await axios.get(api.url);
      const endTime = Date.now();

      const validatedData = api.validate(response.data);

      console.log("✅ Success!");
      console.log("Response time:", `${endTime - startTime}ms`);
      console.log("Validated data:", validatedData);
      console.log("Rate limit info:", {
        remaining: response.headers["x-ratelimit-remaining"],
        limit: response.headers["x-ratelimit-limit"],
        reset: response.headers["x-ratelimit-reset"],
      });
    } catch (error) {
      console.log(`❌ Error testing ${api.name}:`);
      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Headers:", error.response.headers);
        console.log("Data:", error.response.data);
      } else {
        console.log("Error:", error.message);
      }
    }
    console.log("\n-------------------\n");
  }
};

// Run the tests
testCryptoPriceApis().then(() => {
  console.log("API tests completed");
});
