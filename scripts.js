// Decode Google JSON web token
function decodeJWT(token) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split("")
            .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
    );
    return JSON.parse(jsonPayload);
}

// Login handler
async function onSignIn(response) {
    const userData = decodeJWT(response.credential);

    if (!userData.email.endsWith("@torontomu.ca")) {
        alert("Access restricted to @torontomu.ca email addresses.");
        return;
    }

    document.getElementById("mainContent")?.style?.setProperty("display", "block");
    document.getElementById("landingContainer")?.style?.setProperty("display", "none");

    sessionStorage.setItem("credential", response.credential);
    sessionStorage.setItem("userData", JSON.stringify(userData));

    try {
        const result = await checkIfUserExists(userData.email);
        let role = "Student";

        if (result.exists) {
            role = result.data.role || "Student";
        } else {
            const newUser = await createUserInDB(
                userData.given_name,
                userData.family_name,
                userData.email,
                "Student"
            );
            if (newUser) role = newUser.role;
        }

        sessionStorage.setItem("role", role);
    } catch {
        sessionStorage.setItem("role", "Student");
    }
}

// Supabase setup
const SUPABASE_URL = "https://mtjgmoctyzgfubkpsydg.supabase.co";
const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10amdtb2N0eXpnZnVia3BzeWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2Mjc5MTksImV4cCI6MjA3NTIwMzkxOX0.9Ku1_VjUhsBUtHwPSiBCYAez8sWyhK0x6Hc2SVxpqnk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DB helpers
async function checkIfUserExists(email) {
    try {
        const { data } = await supabaseClient
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        return data
            ? { exists: true, data }
            : { exists: false, data: null };
    } catch {
        return { exists: false, data: null };
    }
}

async function createUserInDB(firstName, lastName, email, role) {
    try {
        const { data } = await supabaseClient
            .from("users")
            .insert([{ firstName, lastName, email, role }])
            .select()
            .maybeSingle();
        return data;
    } catch {
        return null;
    }
}

// Session restore
function initializeSession() {
    const credential = sessionStorage.getItem("credential");
    const userData = sessionStorage.getItem("userData");

    if (credential && userData) {
        document.getElementById("mainContent")?.style?.setProperty("display", "block");
        document.getElementById("landingContainer")?.style?.setProperty("display", "none");
    }
}

// MAIN PAGE EVENTS
window.addEventListener("DOMContentLoaded", () => {
    initializeSession();

    // permissions for create events
    const createEventsLink = document.getElementById("createEventsLink");
    if (createEventsLink) {
        createEventsLink.onclick = (e) => {
            const role = sessionStorage.getItem("role");
            if (!["Department Admin", "Club Leader", "System Administrator"].includes(role)) {
                e.preventDefault();
                alert("You do not have permission to create events.");
            }
        };
    }

    // Modal controls
    const modal = document.getElementById("createEventModal");
    const openBtn = document.getElementById("openCreateEventModal");
    const closeBtn = document.getElementById("closeCreateEventModal");

    if (openBtn) openBtn.onclick = () => modal.style.display = "flex";
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";

    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };

    // Form submission
    const form = document.getElementById("createEventForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const sessionUser = sessionStorage.getItem("userData");
        if (!sessionUser) {
            alert("Please log in first.");
            return;
        }

        const user = JSON.parse(sessionUser);

        const title = document.getElementById("eventTitle").value.trim();
        const description = document.getElementById("eventDescription").value.trim();
        const start = document.getElementById("eventStart").value;
        const end = document.getElementById("eventEnd").value;
        const location = document.getElementById("eventLocation").value.trim();
        const category = document.getElementById("eventCategory").value.trim();
        const host = document.getElementById("eventHostOrg").value.trim();
        const capacity = parseInt(document.getElementById("eventCapacity").value);

        if (!title || !description || !start || !end || !location || !category || !host || !capacity) {
            alert("Please fill in all fields.");
            return;
        }

        const { error } = await supabaseClient
            .from("events")
            .insert([{
                title,
                description,
                start_time: start,
                end_time: end,
                location,
                category,
                "hosting organization": host,
                capacity,
                createdBy: user.email
            }]);

        if (error) {
            alert("Failed to create event.");
            return;
        }

        alert("Event created successfully!");
        modal.style.display = "none";
        window.location.href = "index.html";
    });
});
