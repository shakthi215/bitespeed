import { Router, Request, Response } from "express";
import { identifyContact } from "../services/contactService";

const router = Router();

router.post("/identify", (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body ?? {};

    // Validate: at least one field must be present
    const hasEmail = email !== undefined && email !== null && email !== "";
    const hasPhone = phoneNumber !== undefined && phoneNumber !== null && phoneNumber !== "";

    if (!hasEmail && !hasPhone) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Provide at least one of 'email' or 'phoneNumber'.",
      });
    }

    const contact = identifyContact({ email, phoneNumber });
    return res.status(200).json({ contact });

  } catch (err) {
    console.error("[POST /identify]", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong. Please try again.",
    });
  }
});

export default router;
