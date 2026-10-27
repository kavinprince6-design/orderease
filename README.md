# OrderEase — สั่งของ supplier ให้ 4 ร้าน

เว็บสั่งของจาก supplier (Gulfwest, Bidfood, Laila Garden, ซื้อเงินสด ฯลฯ) ให้ร้าน **The Plane, Daily Edition Cafe, Bupa** และร้านที่ 4
ค้นหาสินค้าแล้วกด + จำนวน รหัสสินค้าติดมาเอง ไม่ต้องพิมพ์รหัสทีละตัว แล้วส่งให้ supplier ทาง WhatsApp หรือใบ Purchase Order (PDF)

| หน้า | ทำอะไรได้ |
|---|---|
| Dashboard | ยอดสั่งเดือนนี้ ออเดอร์ที่รอของเข้า สินค้าที่ยังไม่มีรหัส ยอดแต่ละร้าน กราฟ 14 วัน |
| New order | เลือกร้าน → เลือก supplier → ค้นหา/กด + Add → Place order · มี ★ ของที่สั่งประจำ · จำออเดอร์ที่ยังทำไม่เสร็จไว้ในเครื่อง |
| Order | ข้อความ WhatsApp พร้อมรหัส (Copy / เปิด WhatsApp), ใบ PO PDF, Mark as received, Edit, Order again, Cancel |
| Orders | ค้นหาออเดอร์ตามวันที่ ร้าน supplier สถานะ หรือชื่อ/รหัสสินค้า |
| Catalog | เพิ่ม/แก้สินค้า รหัส ขนาดบรรจุ ราคา รูป · ดาวน์โหลดแม่แบบ Excel · Import Excel · Export |
| Suppliers | เพิ่ม/แก้ supplier เบอร์ WhatsApp อีเมล |
| Reports | รายวัน / รายเดือน / รายปี / กำหนดเอง · กรองร้าน supplier · Note ใต้รายงาน · ดาวน์โหลด PDF / Word / Excel / Print |
| Settings | ร้าน (เปลี่ยนชื่อ สี รหัสย่อ ที่อยู่ เพิ่มร้าน) · ผู้ใช้ · ชื่อบริษัทบนใบ PO · ข้อความทักทาย · เปลี่ยนรหัสผ่าน · Activity log |

ความปลอดภัย: รหัสผ่านเข้ารหัส (PBKDF2) · ใส่รหัสผิด 5 ครั้ง ล็อก 10 นาที · ไม่ใช้งาน 30 นาที log out เอง · Staff เห็นเฉพาะร้านที่ Admin เลือกให้

ข้อมูลตั้งต้น (แก้/ลบได้ทั้งหมดในเว็บ): 4 ร้าน, 4 supplier, สินค้าตัวอย่าง 12 รายการจากแชท WhatsApp

---

## ติดตั้งผ่านหน้าเว็บ Cloudflare (ไม่ต้องพิมพ์คำสั่ง)

ทำแบบเดียวกับเว็บ the-plane-stock

**1. สร้างฐานข้อมูล**
Cloudflare Dashboard → **Storage & Databases → D1 SQL Database → Create** → ตั้งชื่อ `orderease` → Create
(ไม่ต้องสร้างตารางเอง เว็บจะสร้างให้อัตโนมัติเมื่อเปิดครั้งแรก)

**2. สร้างเว็บจาก GitHub**
**Workers & Pages → Create → แท็บ Pages → Connect to Git** → เลือก repo `orderease` → Begin setup
- Project name: `orderease`
- Framework preset: **None**
- Build command: *(เว้นว่าง)*
- Build output directory: **public**
→ **Save and Deploy**

**3. เชื่อมเว็บกับฐานข้อมูล**
เข้าโปรเจกต์ → **Settings → Bindings → Add → D1 database**
- Variable name: **DB**
- D1 database: **orderease**
→ Save

**4. Deploy ใหม่หนึ่งครั้ง** แท็บ **Deployments** → **⋯** ที่รายการล่าสุด → **Retry deployment**

**5. เปิดเว็บ** `https://orderease.pages.dev` (หรือชื่อที่ Cloudflare ให้) → หน้า First-time setup → สร้างบัญชี Admin ให้ Michael
แล้วไปที่ **Settings → Users** เพิ่มบัญชีพนักงาน และ **Settings → Restaurants** เปลี่ยนชื่อ "Restaurant 4"

> ถ้าขึ้นว่า *The database is not connected yet* = ยังไม่ได้ทำข้อ 3 หรือข้อ 4

เขตเวลาเริ่มต้นคือ Asia/Riyadh ถ้าจะเปลี่ยน: **Settings → Variables and Secrets → Add** ชื่อ `TIMEZONE` ค่าเช่น `Asia/Bangkok` แล้ว Retry deployment

## ใส่ข้อมูลภายหลัง
- **ร้าน**: Settings → Restaurants
- **Supplier**: หน้า Suppliers → Add supplier (ใส่เบอร์ WhatsApp เพื่อให้ปุ่ม WhatsApp เปิดแชทนั้นทันที)
- **สินค้า/รหัส**: Catalog → Excel template → กรอก → Import Excel (สินค้าที่มีอยู่แล้วจะถูกอัปเดต ไม่ซ้ำ)
  หรือส่ง PDF catalog ให้ Claude แปลงเป็น Excel ตามแม่แบบ แล้วกด Import

## แก้ไขเว็บภายหลัง
แก้ไฟล์ใน GitHub แล้ว Cloudflare deploy ให้ใหม่อัตโนมัติ ข้อมูลในฐานข้อมูลอยู่ครบ
