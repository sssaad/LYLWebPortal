import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { getConfirmEmail } from "../api/getConfirmEmail";
import { updateEmailTemplate } from "../api/updateEmailTemplate"; // ✅ new import

const EmailLayer = () => {
  const [emails, setEmails] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // State for modal
  const [showModal, setShowModal] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(null);

  // Placeholders list (static display only)
  const placeholders = [
    { key: "{{username}}", desc: "For Student Name, Teacher Name, Parent Name" },
    { key: "{{teacher_name}}", desc: "For Teacher Name" },
    { key: "{{student_name}}", desc: "For Student Name" },
    { key: "<br>", desc: "For Line Break" },
    { key: "{{otp}}", desc: "For OTP" },
    { key: "{{book_date}}", desc: "For Booking Date" },
    { key: "{{slot1_time}}", desc: "For Booking Start Time" },
    { key: "{{slot2_time}}", desc: "For Booking End Time" },
  ];

  // Fetch emails from API
  useEffect(() => {
    const fetchEmails = async () => {
      const data = await getConfirmEmail();
      if (data) {
        const mappedData = data.map((item) => ({
          id: item.id, // ✅ id added
          type: item.email_type,
          subject: item.email_subject,
          text: item.email_text,
        }));
        setEmails(mappedData);
      }
      setInitialLoading(false);
    };

    fetchEmails();
  }, []);

  // Open modal with selected email
  const handleEdit = (email, index) => {
    setCurrentEmail({ ...email, index });
    setShowModal(true);
  };

  // Handle form submit with API + confirmation + loader
  const handleSave = async () => {
    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to update this email template?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update it!",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Loader while updating
        Swal.fire({
          title: "Updating...",
          text: "Please wait while we update the template.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const success = await updateEmailTemplate(currentEmail.id, {
          email_subject: currentEmail.subject,
          email_text: currentEmail.text,
        });

        if (success) {
          const updatedEmails = [...emails];
          updatedEmails[currentEmail.index] = { ...currentEmail };
          setEmails(updatedEmails);
          setShowModal(false);

          Swal.fire({
            icon: "success",
            title: "Updated!",
            text: "Email template updated successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Failed!",
            text: "Something went wrong while updating.",
          });
        }
      }
    });
  };

  // Function to shorten long email text for table view
  const getPreview = (text, limit = 50) => {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  if (initialLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "300px" }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "6px solid #e0e0e0",
            borderTop: "6px solid #45B369",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="row gy-4">
      <div className="col-xxl-12">
        <div className="card h-100 p-0 email-card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th className="text-center">S.L</th>
                    <th className="text-center">Email Type</th>
                    <th className="text-center">Email Subject</th>
                    <th className="text-center">Email Text</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email, index) => (
                    <tr key={index}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center">{email.type}</td>
                      <td className="text-center">
                        <Link
                          to="/view-details"
                          className="text-primary fw-medium"
                        >
                          {email.subject}
                        </Link>
                      </td>
                      <td className="text-center">
                        {getPreview(email.text, 60)}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEdit(email, index)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emails.length === 0 && (
                <p className="text-center my-3">No emails found</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Email</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {currentEmail && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Email Type</label>
                      <input
                        type="text"
                        className="form-control"
                        value={currentEmail.type}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Subject</label>
                      <input
                        type="text"
                        className="form-control"
                        value={currentEmail.subject}
                        onChange={(e) =>
                          setCurrentEmail({
                            ...currentEmail,
                            subject: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Text</label>
                      <textarea
                        className="form-control"
                        rows="10"
                        value={currentEmail.text}
                        onChange={(e) =>
                          setCurrentEmail({
                            ...currentEmail,
                            text: e.target.value,
                          })
                        }
                      ></textarea>
                    </div>

                    {/* Placeholders Section */}
                    <div className="mt-3 p-3 bg-dark rounded border text-white">
                      <h6>Available Static Variables:</h6>
                      <ul className="list-unstyled mb-0">
                        {placeholders.map((p, i) => (
                          <li key={i} className="mb-1">
                            <code>{p.key}</code> – <small>{p.desc}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailLayer;
