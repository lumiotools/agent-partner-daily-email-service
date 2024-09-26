import express from "express";
import cors from "cors";
import { sendEmails } from "./service/emailService.js";
import { connectDb } from "./db/dbConnect.js";
import Email from "./models/emails.model.js";
import dotenv from "dotenv";
import { insertDailyEmail } from "./service/insertNewFututerEmail.js";
import { deleteDailyEmail } from "./service/deleteDailyEmail.js";
import DailyEmail from "./models/futureDailyEmails.js";

dotenv.config();
const app = express();

// express middleware
app.use(express.json());
app.use(cors());

// initialize the all services
async function init() {
  await connectDb();
}

init();

app.get("/", (req, res) => {
  res.send("server running update..");
});

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const monthsOfYear = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateMessage() {
  const today = new Date();
  const dayOfWeek = daysOfWeek[today.getDay()];
  const month = monthsOfYear[today.getMonth()];
  const day = today.getDate();
  return `${month} ${day} — Happy ${dayOfWeek}`;
}
// Send email route
app.post("/send-email", async function (req, res) {
  try {
    const { email } = req.body;
    const aiImageGeneratorData = await fetch(
      "https://quote-generator-90rw.onrender.com/generate-quote-image"
    );
    const aiGeneratedImageResponse = await aiImageGeneratorData.json();

    const result = await sendEmails(
      [email],
      aiGeneratedImageResponse?.message,
      aiGeneratedImageResponse?.cloudinaryResponse?.secure_url,
      aiGeneratedImageResponse?.subject,
      formatDateMessage()
    );

    if (!result) {
      return res.status(400).json({ message: "Email send unsuccessful" });
    }

    // Add email to the database if sent successfully
    await Email.create({ email });
    console.log("new email add ", email);

    res.json({ message: "Email sent successfully", data: result });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// add emails
app.post("/add-emails", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res
        .status(400)
        .json({ message: "Invalid input format, expected an array of emails" });
    }

    const emailDocs = emails.map((email) => ({ email }));

    // Insert emails into the database
    await Email.insertMany(emailDocs, { ordered: false });

    res.status(200).json({ message: "Emails added successfully" });
  } catch (error) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ message: "Some emails already exist in the database" });
    } else {
      res.status(500).json({ message: "Server error", error });
    }
  }
});

// console.log(insertDailyEmail());
// 66f5178af8af399b85d09a5b
// deleteDailyEmail("66f5178af8af399b85d09a5b");

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert to 12-hour format
  const formattedHours = hours % 12 || 12; // If hours is 0, set it to 12
  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes; // Add leading zero if needed

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}


// Example usage
const currentTime = getCurrentTime();
console.log(currentTime); // Outputs: "11:24 PM"

const sendEmailsEveryDay = async () => {
  try {
    console.log("finding email template on db");
    const DailyEmailTemplet = await DailyEmail.find();
    console.log(DailyEmailTemplet[0]);
    console.log("finding emails on db");
    const emails = await Email.find().select("email -_id").lean();
    const emailAddresses = emails.map((doc) => doc.email);
    // await sendEmails(emails, message, imageUrl, subject, formatDateMessage);
    console.log("sending daily emails");

    await sendEmails(
      emailAddresses,
      DailyEmailTemplet[0].message,
      DailyEmailTemplet[0].image,
      DailyEmailTemplet[0].title,
      DailyEmailTemplet[0].scheduledDate
    );
    await insertDailyEmail();
    console.log("deleteing daily email [0] index");
    deleteDailyEmail(DailyEmailTemplet[0]._id);
  } catch (error) {
    console.log(error);
  }
};
// sendEmailsEveryDay();


function addTwoMinutes(timeString) {
  // Parse the time string
  const [time, period] = timeString.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  // Convert to 24-hour format if PM
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  // Add 2 minutes
  minutes += 2;

  // Handle minute overflow
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }

  // Handle hour overflow
  hours = hours % 24;

  // Convert back to 12-hour format
  let newPeriod = "AM";
  if (hours >= 12) {
    newPeriod = "PM";
    if (hours > 12) {
      hours -= 12;
    }
  }
  if (hours === 0) {
    hours = 12;
  }

  // Format the result
  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes} ${newPeriod}`;
}

let emailSentTime = "3:40 PM";
let ifSent = false;
setInterval(() => {
  const currentTime = getCurrentTime();
  console.log(currentTime);
  if (currentTime == emailSentTime && ifSent == false) {
    ifSent = true;
    console.log("cll");
    sendEmailsEveryDay();
  }

  if (currentTime == addTwoMinutes(emailSentTime) && ifSent == true) {
    console.log("set false");
    ifSent = false;
  }
}, 1000);

app.post("/change-auto-email-sent-time", (req, res) => {
  try {
    const { newTime } = req.body;
    emailSentTime = newTime;
    res.send("auto email sent time updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.get("/newsletter-data", async(req, res) => {
  try {
    const DailyEmailTemplet = await DailyEmail.find();
    const currentTime = getCurrentTime();
    res.json({
      DailyEmailTemplet,
      serverCurrentTime: currentTime,
      emailSentTime,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Delete email route
app.delete("/email/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the ID from the route parameters
    const deletedEmail = await Email.findByIdAndDelete(id); // Delete email by ID

    if (!deletedEmail) {
      return res.status(404).json({ message: "Email not found" });
    }

    return res
      .status(200)
      .json({ message: "Email deleted successfully", deletedEmail });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
});

// listen the app on 2000 port
app.listen(process.env.PORT || 2000, () => {
  console.log(`server listening on port ${process.env.PORT}`);
});
