import db from "../models/index.js";
import { ApiResponse } from "../utils/apiResponse.js";
const { User } = db;

export const userDetails = async (req, res) => {  
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        return ApiResponse.success(res, {
            message: "user retrieved succesfully",
            user
        })
    } catch (error) {
        console.log("error fetching user details: ", error);
        return ApiResponse.serverError(res, error.message || "error fetching user details", error.response?.data)
    }
}