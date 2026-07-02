import os

def main():
    input_file = "migration_output.sql"
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    lines_per_file = 3000
    
    print(f"Splitting {input_file} smartly around {lines_per_file} lines each...")

    part_num = 1
    current_chunk = []
    
    for line in lines:
        # If we reached the target size AND the current line is a safe boundary
        if len(current_chunk) >= lines_per_file and line.startswith("INSERT INTO"):
            part_file = f"migration_output_part{part_num}.sql"
            with open(part_file, "w", encoding="utf-8") as f_out:
                f_out.write("".join(current_chunk))
            print(f" - Created: {part_file} ({len(current_chunk)} lines)")
            part_num += 1
            current_chunk = []
            
        current_chunk.append(line)
        
    # Write the last chunk
    if current_chunk:
        part_file = f"migration_output_part{part_num}.sql"
        with open(part_file, "w", encoding="utf-8") as f_out:
            f_out.write("".join(current_chunk))
        print(f" - Created: {part_file} ({len(current_chunk)} lines)")

    print("\n[SUCCESS] Split completed! You can copy and run these files one by one in the SQL Editor.")

if __name__ == "__main__":
    main()
