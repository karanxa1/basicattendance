const students = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Adjust based on student count
const attendance = {};

// Get references
const studentContainer = document.getElementById("student-container");
const submitBtn = document.getElementById("submit-btn");

// Create student buttons dynamically
students.forEach((id) => {
    const button = document.createElement("button");
    button.textContent = `Student ${id}`;
    button.classList.add("student-button", "absent"); // Default: Absent
    button.dataset.id = id;
    attendance[id] = "Absent"; // Default to "Absent"

    button.addEventListener("click", () => {
        if (attendance[id] === "Absent") {
            attendance[id] = "Present";
            button.classList.remove("absent");
            button.classList.add("present");
        } else {
            attendance[id] = "Absent";
            button.classList.remove("present");
            button.classList.add("absent");
        }
    });

    studentContainer.appendChild(button);
});

// Submit attendance
submitBtn.addEventListener("click", async () => {
    const date = new Date().toISOString().split("T")[0];

    const data = students.map((id) => ({
        studentId: id,
        status: attendance[id], // Ensure value is defined
    }));

    try {
        const response = await fetch("/submit-attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attendance: data, date }),
        });

        const result = await response.json();
        alert(result.message);
        loadChart();
    } catch (error) {
        console.error("Error submitting attendance:", error);
    }
});

// Load Attendance Chart
async function loadChart() {
    const response = await fetch("/attendance-data");
    const data = await response.json();

    const ctx = document.getElementById("attendanceChart").getContext("2d");
    new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Present", "Absent"],
            datasets: [{
                data: [data.Present, data.Absent],
                backgroundColor: ["green", "red"],
            }],
        },
    });
}

window.onload = loadChart;
