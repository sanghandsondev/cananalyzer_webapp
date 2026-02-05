const axios = require("axios");

exports.createLicense = async function(orderId) {
    try {
        const response = await axios({
            url: process.env.LICENSE_SERVICE_URL + "/default/License_Generate_Func",
            method: "post",
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify({ orderId }),
        });

        console.log("Create License Response:");
        console.log(response.data);

        return response.data;
    } catch (error) {
        console.error("Error creating license:", error.response ? error.response.data : error.message);
        return null;
    }
}