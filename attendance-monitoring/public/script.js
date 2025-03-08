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
    try {
        const date = new Date().toISOString().split("T")[0];

        const data = students.map((id) => ({
            studentId: id,
            status: attendance[id], // Ensure value is defined
        }));

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const response = await fetch("/submit-attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attendance: data, date }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to submit attendance");
        }

        const result = await response.json();
        alert(result.message || "Attendance saved successfully!");
        
        // Reload the chart to reflect the new data
        loadChart();
    } catch (error) {
        console.error("Error submitting attendance:", error);
        alert(error.message || "Error submitting attendance. Check console for details.");
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Attendance";
    }
});

// Load Attendance Chart
async function loadChart() {
    try {
        const response = await fetch("/attendance-data");
        
        if (!response.ok) {
            throw new Error("Failed to fetch attendance data");
        }
        
        const data = await response.json();

        // Clear any existing chart
        const chartContainer = document.getElementById("attendanceChart");
        const ctx = chartContainer.getContext("2d");
        
        // Check if a chart instance already exists
        if (window.attendanceChartInstance) {
            window.attendanceChartInstance.destroy();
        }
        
        // Create the new chart
        window.attendanceChartInstance = new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["Present", "Absent"],
                datasets: [{
                    data: [data.Present || 0, data.Absent || 0],
                    backgroundColor: ["green", "red"],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Attendance Distribution'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error loading chart:", error);
        document.getElementById("attendanceChart").innerHTML = 
            '<p style="color: red; text-align: center;">Failed to load attendance chart</p>';
    }
}

// Initialize on page load
window.onload = function() {
    loadChart();
};