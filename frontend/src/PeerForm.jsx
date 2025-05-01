import { useForm } from "react-hook-form";
import "./PeerForm.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function PeerForm({ IP }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      instanceName: "",
      ip: IP,
      osImage: "",
      username: "admin",
      rootPassword: "",
      confirmRootPassword: "",
      extraUsers: "",
      tools: ""
    }
  });
  
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  
  // Watch passwords to validate they match
  const password = watch("rootPassword");
  const confirmPassword = watch("confirmRootPassword");

  const onSubmit = async (data) => {
    // Reset any previous errors
    setError(null);
    
    // Check if passwords match
    if (data.rootPassword !== data.confirmRootPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      console.log("Starting instance with data:", {
        ...data,
        rootPassword: "[REDACTED]",
        confirmRootPassword: "[REDACTED]"
      });
      
      // Prepare the request data
      const requestData = {
        instanceName: data.instanceName,
        ip: IP, // Use the IP passed as prop
        osImage: data.osImage,
        username: data.username,
        rootPassword: data.rootPassword,
        extraUsers: data.extraUsers,
        tools: data.tools
      };
      
      // Send the request to the backend
      const response = await axios.post("http://localhost:5000/start_shell", requestData);
      
      if (response.data && response.data.container_id) {
        // Navigate to terminal with the container ID
        navigate(`/terminal/${response.data.container_id}`);
      } else {
        setError("Invalid response from server. No container ID received.");
      }
    } catch (err) {
      console.error("Error launching instance:", err);
      setError(err.response?.data?.error || err.message || "Failed to launch instance");
    }
  };

  return (
    <form className="peer-form" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="form-title">Launch Virtual Instance</h2>
      
      {error && <div className="error-message">{error}</div>}

      <label>Instance Name</label>
      <input
        className="input"
        {...register("instanceName", { 
          required: "Instance name is required",
          pattern: {
            value: /^[a-zA-Z0-9_-]+$/,
            message: "Instance name can only contain letters, numbers, hyphens and underscores"
          }
        })}
        placeholder="MyInstance01"
      />
      {errors.instanceName && <span className="error">{errors.instanceName.message}</span>}

      <label>IP Address</label>
      <input
        className="input read-only"
        defaultValue={IP}
        readOnly
        {...register("ip")}
      />

      <label>OS Image</label>
      <select 
        className="input" 
        {...register("osImage", { 
          required: "Please select an OS" 
        })}
      >
        <option value="">Select OS</option>
        <option value="ubuntu">Ubuntu</option>
        <option value="kalilinux/kali-rolling">Kali</option>
        <option value="alpine">Alpine</option>
        <option value="centos">CentOS</option>
        <option value="archlinux">Arch</option>
      </select>
      {errors.osImage && <span className="error">{errors.osImage.message}</span>}

      <label>Username</label>
      <input
        className="input"
        {...register("username", { required: "Username is required" })}
        placeholder="admin"
      />
      {errors.username && <span className="error">{errors.username.message}</span>}

      <label>Root Password</label>
      <input
        type="password"
        className="input"
        {...register("rootPassword", { 
          required: "Password is required",
          minLength: {
            value: 6,
            message: "Password must be at least 6 characters"
          }
        })}
      />
      {errors.rootPassword && <span className="error">{errors.rootPassword.message}</span>}

      <label>Retype Root Password</label>
      <input
        type="password"
        className="input"
        {...register("confirmRootPassword", { 
          required: "Please confirm your password",
          validate: value => value === password || "Passwords do not match"
        })}
      />
      {errors.confirmRootPassword && (
        <span className="error">{errors.confirmRootPassword.message}</span>
      )}

      <label>Extra Users (comma separated)</label>
      <input
        className="input"
        {...register("extraUsers")}
        placeholder="user1,user2"
      />

      <label>Tools to Download on Boot</label>
      <textarea
        className="input textarea"
        {...register("tools")}
        placeholder="docker, git, vim..."
      />

      <button className="submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Launching..." : "Launch Instance"}
      </button>
    </form>
  );
}