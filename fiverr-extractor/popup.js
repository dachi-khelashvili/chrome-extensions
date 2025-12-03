const emailsBox = document.getElementById("emails");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const locationEl = document.getElementById("location");
const dateEl = document.getElementById("date");
const pageEl = document.getElementById("page");
const openEl = document.getElementById("open");

let fiverrUrls = [];

document.getElementById("scan").addEventListener("click", scanAllTabs);
document.getElementById("copy").addEventListener("click", copyAll);
document.getElementById("close").addEventListener("click", closeAll);

async function scanAllTabs() {
    statusEl.textContent = "Scanning…";
    emailsBox.textContent = "";
    countEl.textContent = "0";

    try {
        const tabs = await chrome.tabs.query({});
        // Only inject into http/https tabs (Chrome blocks chrome://, Web Store, PDFs, etc.)
        const candidates = tabs.filter(t => t.url && /^https?:\/\//i.test(t.url));

        const injections = await Promise.allSettled(
            candidates.map(tab =>
                chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        // Runs IN THE TAB
                        const found = new Set();

                        // mailto: links (can contain multiple emails separated by , or ;)
                        document.querySelectorAll('a[class^="text-bold _1lc1p3l2"]').forEach(a => {
                            const href = a.getAttribute("href") || "";
                            const text = a.textContent;
                            const name = text.split(" ")[0].split(".")[0];
                            const raw = href.split("?")[0];
                            
                            const names = `Kirsty Christie Kimberly Alexis Bethanyrr Matinya Lottie Precious Serah Peculiar Esther Aisha Rachel Susy Wren Beth Tammy Dorothy Lina Lila Lilly Lea Beatrice Purity Janet Gracias Gift Priscila Olivine Cathia Josphine Sydney Janice Annah Lucile Hope Sofia Tovia Pelumi Sweet Tabitha Amanda Jeniffer Jessy Mary Kemisola Jennifer Mandy Serena Christiana Ninet Sandy Charlotter Fateemah Mary_smart4560 Clarice Rita Yvonne Solona Shana Treasure Prudence Ola Ashanti Lara StephanieL Raya Jumoke Judith Debbie Zemi Kyla Clarissa Joyce Doris Kamila Estella Joel Nicole Lizzy Abel Debble Heidi Louisiana Vanessa Marina Lindsey Jolene Selena Valerie Adele Marlee Mira Jina Kaia Mallory Angela Johanna Amelisa Tessa Annika Irene Lizah Aveline Elara Helena Linda Bella Adrea Gina Agnes Rose Becca Kendra Angelina Macie Monroe Alisha Anniy Carmen Brienne Julia Barbara Diana Lexie Tonia Evans Camille Mckenna Normah Courtney Ellie Elina Mellisa Cassandra Pauline Stella Shannon Ireti Jessica Celine Collette Shauntaye Jeanne Lauren Zarina Joanna Erin Cassidy Leigh Liyah Amy Brittany Charley Dalexandra Erica Kristen Rebecca Justina Nissih Abishaleen Juliet Kate Lillian Monica Haley Rhophiyat Sandra Elisabeth Fiona Yohanna Lisa Vasha Elizabeth Anita Rachael Marcia Daisy Dahlia Odessa Belinda Nancy Patricia Anabel Sloane Rae Whitney Rea Dorcas Katherine Oliviah Elsie Marilyn Kyra Natasha Dominique Sia Goldie Melissa Helen Charllotte Audrina Amber Zara Danielle Talia Priscy Susan Heather Katie Emma Olivia Ava Sophia Mia Amelia Isabella Charlotte Harper Evelyn Abigail Emily Ella Grace Chloe Madison Avery Scarlett Lily Aria Zoey Riley Mila Layla Nora Luna Victoria Camila Penelope Hannah Addison Eleanor Hazel Violet Aurora Savannah Brooklyn Claire Skylar Lucy Paisley Everly Anna Caroline Nova Genesis Emilia Kennedy Samantha Maya Willow Kinsley Naomi Aaliyah Elena Sarah Ariana Allison Gabriella Alice Madelyn Cora Ruby Eva Serenity Autumn Adeline Hailey Gianna Piper Sadie Lydia Aubrey Jade Peyton Sophie Brielle Clara Vivian Rylee Josephine Delilah Natalia Athena Maria Eliana Bailey Quinn Reese Hadley Emery Jasmine Valentina Isla Taylor Khloe Kylie Mallly Florence Mercy Esterra Carla Ricce Beatrix Carolyn Diasy Laurie Nichole Gloria Cassy Praise Michelle Loveth Evie Faith Favour Darasimi Mirabel Deborah Evangeline Surprise Laura Lora Lilian Mariao Emmy Success Catherine Crystal Dami Ashley Fransi Blessing Margaret Sophy Klara Mariam Ellarose Tara Stephosa Shola Tasha Camilla Stephenie Regina Derniela Alexandra Katrine Kathy Comfort Davina Anthonia Odette Melisa Verlene Riana Tracy Silvia Rhoda Duangkamol Anne Kali Heritage Mellanie Audrey Betty Nathalie`
                            if(!names.includes(name)){
                                found.add(`https://pro.fiverr.com/freelancers${raw}`);
                                // found.add(`${name}`);
                            }
                        });

                        return Array.from(found);
                    }
                })
            )
        );

        // Collect results from all frames of all tabs
        const aggregate = [];
        for (const res of injections) {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
                for (const frame of res.value) {
                    if (frame && Array.isArray(frame.result)) {
                        aggregate.push(...frame.result);
                    }
                }
            }
        }

        // De-duplicate (case-insensitive), trim
        const seen = new Set();
        const deduped = [];
        for (const e of aggregate) {
            const clean = e.trim();
            const key = clean.toLowerCase();
            if (clean && !seen.has(key)) {
                seen.add(key);
                deduped.push(clean);
            }
        }

        fiverrUrls = deduped;
        emailsBox.textContent = deduped.length ? deduped.join("\n") : "No emails found.";
        countEl.textContent = `(${String(deduped.length)})`;

        // Note about blocked pages
        const blockedCount = tabs.length - candidates.length;
        statusEl.textContent = blockedCount > 0
            ? `Done. Skipped ${blockedCount} disallowed tab(s) (e.g., chrome://, Web Store, PDFs).`
            : "Done.";
    } catch (err) {
        emailsBox.textContent = "Error: " + err.message;
        statusEl.textContent = "Failed.";
    }
}

async function copyAll() {
    if (!fiverrUrls.length) {
        statusEl.textContent = "Nothing to copy.";
        return;
    }
    try {
        await navigator.clipboard.writeText(fiverrUrls.join("\n"));
        statusEl.textContent = "Copied!";
        setTimeout(() => (statusEl.textContent = ""), 1200);
    } catch (e) {
        statusEl.textContent = "Clipboard blocked. Try again.";
    }
}

async function closeAll() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url && tab.url.includes("pro.fiverr.com/categories") && !tab.url.includes("page=1&")) {
                chrome.tabs.remove(tab.id);
            }
        });
    });
}