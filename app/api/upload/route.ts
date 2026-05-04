import { NextRequest } from "next/server";
import { uploadImage } from "@/lib/cloudinary";
import { ok, err, handleError } from "@/lib/errors";
import { getUserId } from "@/lib/auth";

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload Image
 *     description: Upload an image file (multipart/form-data) to Cloudinary and get a secure URL.
 *     tags: [Utility]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 */
export async function POST(req: NextRequest) {
  try {
    // Ensure user is authenticated
    getUserId(req);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return err("No file provided", 400);
    }

    // Convert file to base64 for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileBase64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const url = await uploadImage(fileBase64);

    return ok({ url });
  } catch (error) {
    return handleError(error);
  }
}
